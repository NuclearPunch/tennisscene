import type { Sql } from "postgres";
import { PERSONAS, type Persona, systemPrompt } from "@/lib/ai/personas";
import { hasBlockedWords } from "@/lib/moderation";
import type { JobReport } from "./types";

/**
 * AI 계정 글쓰기.
 *
 * 하루에 한 번, 그날 쓸 차례인 계정마다 한 편씩 쓴다. 쓴 글은 다른 봇 글과 함께
 * 그날 밤까지 나눠 올라간다(schedule.ts) — 그 사이 관리자 화면 "글 관리" 에서 예약된 글을 보고 뺄 수 있다.
 *
 * **사실은 우리 DB 에 있는 것만 준다.** 대회·부서·라운드·랭킹 소식을 넘기고 그 밖의 사실은 지어내지 말라고 한다.
 * **선수 이름은 넘기지 않는다.** 이름 비공개 요청(suppressed_players)이 들어오면 결과 글은 가릴 수 있지만,
 * AI 가 자유롭게 쓴 문장 속 이름은 찾아 가리기 어렵다.
 *
 * 모델이 규칙을 어긴 글(1인칭 경험담, 링크, 너무 긴 글)은 코드가 한 번 더 거른다.
 * 두 편을 받아서 통과한 첫 편을 쓴다.
 */

const API = "https://api.anthropic.com/v1/messages";
const DEFAULT_MODEL = "claude-sonnet-5";
/** 크론 전체가 60초다. 계정들을 동시에 부르고, 하나가 늦으면 그 계정만 버린다. */
const TIMEOUT_MS = 25_000;
const KST_OFFSET_MS = 9 * 3600_000;
const WEEKDAY = ["일", "월", "화", "수", "목", "금", "토"];

function kstDate(now: Date): { iso: string; weekday: number; label: string } {
  const k = new Date(now.getTime() + KST_OFFSET_MS);
  const iso = k.toISOString().slice(0, 10);
  const wd = k.getUTCDay();
  return { iso, weekday: wd, label: `${k.getUTCMonth() + 1}월 ${k.getUTCDate()}일 ${WEEKDAY[wd]}요일` };
}

/** 이번 주 코트. 이름은 빼고 대회·부서·라운드만. */
async function buildContext(db: Sql, todayIso: string): Promise<string> {
  const [results, upcoming, rankings, videos] = await Promise.all([
    db<{ t: string; divs: string }[]>`
      select payload->>'tournamentName' t,
             string_agg(distinct payload->>'division', ', ') divs
      from posts
      where type = 'result' and deleted_at is null and created_at > now() - interval '8 days'
      group by 1 order by max(created_at) desc limit 5`,
    db<{ name: string; starts: string; ends: string; venue: string | null; divs: string | null }[]>`
      select payload->>'name' name, payload->>'startsOn' starts, payload->>'endsOn' ends,
             payload->>'venue' venue,
             (select string_agg(d, ', ') from jsonb_array_elements_text(payload->'divisions') d) divs
      from posts
      where type = 'tournament' and deleted_at is null
        and (payload->>'startsOn')::date between ${todayIso}::date and ${todayIso}::date + 14
      order by payload->>'startsOn' limit 5`,
    db<{ division: string; story: string | null; week: string }[]>`
      select distinct on (payload->>'division')
             payload->>'division' division, payload->>'story' story, payload->>'week' week
      from posts
      where type = 'ranking' and deleted_at is null and created_at > now() - interval '8 days'
      order by payload->>'division', created_at desc`,
    db<{ t: string | null; d: string | null; r: string | null }[]>`
      select payload->>'tournamentName' t, payload->>'division' d, payload->>'round' r
      from posts
      where type = 'video' and deleted_at is null and created_at > now() - interval '4 days'
        and payload->>'division' is not null
      order by created_at desc limit 6`,
  ]);

  const lines: string[] = [];
  if (results.length) {
    lines.push("끝난 대회 (결과가 올라옴):");
    for (const r of results) lines.push(`- ${r.t} — ${r.divs}`);
  }
  if (upcoming.length) {
    lines.push("다가오는 대회 (2주 안):");
    for (const u of upcoming) {
      const when = u.starts === u.ends ? u.starts : `${u.starts}~${u.ends}`;
      lines.push(`- ${u.name} · ${when}${u.venue ? ` · ${u.venue}` : ""}${u.divs ? ` · ${u.divs}` : ""}`);
    }
  }
  if (rankings.length) {
    lines.push("이번 주 카토 랭킹 소식:");
    for (const r of rankings) lines.push(`- ${r.division}부${r.story ? ` · ${r.story}` : " · 1위 발표"}`);
  }
  if (videos.length) {
    lines.push("최근 올라온 동호인 경기 영상:");
    for (const v of videos) lines.push(`- ${[v.t, v.d, v.r].filter(Boolean).join(" ")}`);
  }
  return lines.length ? lines.join("\n") : "(이번 주에 들어온 소식이 없다)";
}

/**
 * 모델이 규칙을 어긴 글을 거른다. 통과하면 다듬은 본문, 아니면 거른 이유.
 * 프롬프트로 막은 걸 코드가 한 번 더 막는다 — 한 번 새면 피드에 가짜 경험담이 뜬다.
 */
export function checkBody(
  raw: unknown,
  maxLength: number,
  recent: string[],
): { ok: true; body: string } | { ok: false; reason: string } {
  if (typeof raw !== "string") return { ok: false, reason: "본문이 없다" };
  const body = raw.replace(/\r/g, "").replace(/\n{3,}/g, "\n\n").trim();
  if (body.length < 20) return { ok: false, reason: "너무 짧다" };
  if (body.length > maxLength) return { ok: false, reason: `${maxLength}자를 넘는다` };
  if (/https?:\/\/|www\./i.test(body)) return { ok: false, reason: "링크가 있다" };
  if (/(^|\s)@[A-Za-z0-9_]/.test(body)) return { ok: false, reason: "다른 계정을 부른다" };
  if (/#[^\s#]/.test(body)) return { ok: false, reason: "해시태그가 있다" };
  if (/\*\*|^#{1,3}\s|^- /m.test(body)) return { ok: false, reason: "마크다운이 있다" };
  // 사람인 척하는 1인칭. "저는 이렇게 봐요" 같은 의견 표명도 걸리지만, AI 계정이 쓸 말투가 아니라서 같이 막는다.
  if (/(^|[\s.,!?])(제가|저는|저도|저희|제\s(친구|파트너|클럽|동호회|코치))/.test(body)) {
    return { ok: false, reason: "1인칭 경험담이다" };
  }
  if (hasBlockedWords(body)) return { ok: false, reason: "거르는 표현이 있다" };
  const head = body.slice(0, 18);
  if (recent.some((r) => r.startsWith(head))) return { ok: false, reason: "최근 글과 첫마디가 같다" };
  return { ok: true, body };
}

async function callClaude(
  key: string,
  model: string,
  system: string,
  user: string,
): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(API, {
      method: "POST",
      signal: ctrl.signal,
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 1200,
        system,
        messages: [{ role: "user", content: user }],
      }),
    });
    const json = (await res.json()) as {
      content?: { type: string; text?: string }[];
      error?: { message?: string };
    };
    if (!res.ok) throw new Error(`Claude API ${res.status}: ${json.error?.message ?? "?"}`);
    return (json.content ?? [])
      .filter((c) => c.type === "text")
      .map((c) => c.text ?? "")
      .join("");
  } finally {
    clearTimeout(timer);
  }
}

/** 응답에서 JSON 을 꺼낸다. 코드 블록으로 감싸 오는 경우가 있다. */
export function parsePosts(text: string): unknown[] {
  const s = text.indexOf("{");
  const e = text.lastIndexOf("}");
  if (s < 0 || e <= s) return [];
  try {
    const j = JSON.parse(text.slice(s, e + 1)) as { posts?: { body?: unknown }[] };
    return (j.posts ?? []).map((p) => p?.body);
  } catch {
    return [];
  }
}

async function writeFor(
  db: Sql,
  p: Persona,
  context: string,
  day: { iso: string; label: string },
  key: string,
  model: string,
): Promise<string> {
  const aiKey = `${p.handle}:${day.iso}:1`;

  const recent = (
    await db<{ body: string }[]>`
      select body from posts
      where author_id = ${p.accountId} and body is not null
      order by created_at desc limit 12`
  ).map((r) => r.body);

  const user = `오늘은 ${day.label}이다.

[이번 주 코트]
${context}

[최근에 이 계정이 쓴 글]
${recent.length ? recent.map((b) => `- ${b.replace(/\n+/g, " ").slice(0, 120)}`).join("\n") : "(아직 없다)"}`;

  const text = await callClaude(key, model, systemPrompt(p), user);
  const reasons: string[] = [];
  for (const raw of parsePosts(text)) {
    const c = checkBody(raw, p.maxLength, recent);
    if (!c.ok) {
      reasons.push(c.reason);
      continue;
    }
    // 글과 기록을 한 문장으로 넣는다. 같은 키가 이미 있으면 글도 안 들어가고,
    // 동시에 두 번 돌아 키가 부딪히면 문장 전체가 실패해서 글만 남는 일이 없다.
    const inserted = await db`
      with p as (
        insert into posts (author_id, type, body)
        select ${p.accountId}, 'text', ${c.body}
        where not exists (select 1 from ai_posts where ai_key = ${aiKey})
        returning id
      )
      insert into ai_posts (ai_key, post_id, model)
      select ${aiKey}, id, ${model} from p
      returning post_id`;
    return inserted.length ? `${p.name}: ${c.body.replace(/\n+/g, " ").slice(0, 50)}…` : `${p.name}: 이미 썼다`;
  }
  return `${p.name}: 쓸 만한 글이 없었다 (${reasons.join(", ") || "응답을 못 읽었다"})`;
}

export async function runAiPosts(db: Sql, opts: { now?: Date } = {}): Promise<JobReport> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return { job: "ai", summary: "ANTHROPIC_API_KEY 가 없다. AI 글을 쓰지 않았다", lines: [] };
  }
  const model = process.env.ANTHROPIC_MODEL || DEFAULT_MODEL;
  const day = kstDate(opts.now ?? new Date());

  // 오늘 이미 쓴 계정은 건너뛴다. 다시 돌려도 API 를 부르지 않는다.
  const done = new Set(
    (
      await db<{ k: string }[]>`
        select ai_key k from ai_posts where ai_key like ${`%:${day.iso}:%`}`
    ).map((r) => r.k.split(":")[0]),
  );
  const due = PERSONAS.filter((p) => p.days.includes(day.weekday) && !done.has(p.handle));
  if (due.length === 0) {
    return { job: "ai", summary: "오늘 쓸 차례인 AI 계정이 없다(이미 썼다)", lines: [] };
  }

  const context = await buildContext(db, day.iso);
  const results = await Promise.allSettled(due.map((p) => writeFor(db, p, context, day, key, model)));
  const lines = results.map((r, i) =>
    r.status === "fulfilled" ? r.value : `${due[i].name}: 실패 — ${(r.reason as Error)?.message ?? r.reason}`,
  );
  const wrote = lines.filter((l) => !/쓸 만한 글이 없었다|실패|이미 썼다/.test(l)).length;
  return {
    job: "ai",
    summary: `AI 글 ${wrote}건 (${due.map((p) => p.name).join(", ")} 차례)`,
    lines: [`모델 ${model}`, ...lines],
  };
}
