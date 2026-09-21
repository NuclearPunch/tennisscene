import type { Sql } from "postgres";
import { buildPointsLine, buildResultStory } from "@/lib/publish/resultStory";
import { katoTournaments as K } from "@/lib/sources/katoTournaments";
import type { ResultPayload } from "@/lib/types";
import { loadStoryContext } from "./storyContext";
import type { JobReport } from "./types";

const ORG = "kato";

/**
 * 이미 나간 결과 포스트에 해석·포인트 줄을 다시 붙인다.
 *
 * 왜 필요한가: 수집 잡은 대회를 **최신순으로** 훑는다. 그래서 처음 20건을 한 번에
 * 올렸을 때, 나중 대회가 먼저 저장돼 앞선 대회의 이력을 볼 수 없었다.
 * 지금은 3주치가 다 들어와 있으므로 전체를 놓고 다시 계산하면 제대로 된 문장이 나온다.
 *
 * **멱등이다.** 몇 번을 돌려도 같은 결과가 나오고, 문장이 그대로면 건드리지 않는다.
 * 본문 첫 줄(사실)은 절대 바꾸지 않는다 — 뒤에 붙는 줄만 갈아 끼운다.
 */
export async function runBackfillStories(
  db: Sql,
  opts: { dryRun?: boolean } = {},
): Promise<JobReport> {
  const lines: string[] = [];
  const dry = opts.dryRun === true;
  const ctx = await loadStoryContext(db, ORG);

  /*
   * 등급은 결과 포스트에 없다(처음 올릴 때 담지 않았다). 두 곳에서 모은다:
   *   1. 대회 포스트 — 접수중일 때 올린 것만 있어서 최근 몇 개뿐이다
   *   2. 카토 대회 목록 — 50개가 다 있다. 요청 한 번이면 옛 대회까지 채워진다
   * 목록을 못 받아도 잡은 계속 돈다. 포인트 줄만 덜 붙을 뿐이다.
   */
  const grades = new Map<string, string | null>();
  for (const r of await db<{ source_id: string; grade: string | null }[]>`
    select payload ->> 'sourceId' as source_id, payload ->> 'grade' as grade
    from posts where type = 'tournament' and deleted_at is null`) {
    grades.set(r.source_id, r.grade);
  }
  try {
    for (const t of K.parseList(await K.fetchList())) {
      if (!grades.get(t.sourceId)) grades.set(t.sourceId, t.grade);
    }
  } catch {
    lines.push("대회 목록을 못 받았다. 아는 등급으로만 간다.");
  }

  const posts = await db<{ id: string; body: string; payload: ResultPayload }[]>`
    select id, body, payload
    from posts
    where type = 'result' and deleted_at is null and payload ->> 'org' = ${ORG}
    order by payload ->> 'endsOn'`;

  lines.push(
    `결과 포스트 ${posts.length}건 · 이력 보유 선수 ${ctx.counts.history}명 · ` +
      `랭킹 ${ctx.counts.ranks}명 · 등급 아는 대회 ${grades.size}개`,
  );

  let changed = 0;
  let same = 0;

  for (const row of posts) {
    const p = row.payload;
    const grade = p.grade ?? grades.get(p.sourceId) ?? null;
    const input = {
      champion: p.champion,
      division: p.division,
      endsOn: p.endsOn,
      history: ctx.history,
      ranks: ctx.ranks,
      rankAt: ctx.rankAt,
      grade,
      reflected: ctx.reflected(p.endsOn),
    };
    const story = buildResultStory(input);
    const pointsLine = buildPointsLine(input);

    if ((p.story ?? null) === story && (p.pointsLine ?? null) === pointsLine) {
      same++;
      continue;
    }

    // 첫 줄은 사실이라 손대지 않는다. 뒤에 붙어 있던 줄만 떼고 새로 붙인다.
    const headline = row.body.split("\n")[0];
    const body = [headline, story, pointsLine].filter(Boolean).join("\n");

    if (!dry) {
      await db`
        update posts
        set payload = payload || ${db.json({ story, pointsLine, grade })},
            body = ${body}
        where id = ${row.id}`;
    }
    changed++;
    for (const l of [story, pointsLine]) if (l) lines.push(`${p.division} — ${l}`);
  }

  return {
    job: "backfill-stories",
    summary: `${dry ? "바뀔 것" : "바꿈"} ${changed}건 · 그대로 ${same}건`,
    lines,
  };
}
