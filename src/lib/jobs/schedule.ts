import type { Sql } from "postgres";

/**
 * 봇 글을 하루에 나눠 올린다.
 *
 * 아침 9시 수집이 1분 안에 글 수십 개를 올려서 시간순 피드에 같은 종류가 줄줄이 붙었다
 * (최근 60개 중 58개가 영상, 같은 종류 최대 34개 연속).
 *
 * **정렬은 그대로 시간순이다**(CLAUDE.md 규칙 5). 피드 순서를 섞지 않고, 올리는 시각을 나눈다.
 * 잡이 끝나면 아직 안 보인 봇 글을 종류가 번갈아 나오게 세우고, 그날 밤 10시까지 흩어서
 * created_at 을 매긴다. 피드 뷰는 그 시각이 된 글만 보여준다(posts_public).
 *
 * 흩는 동안 이미 보인 글은 건드리지 않는다. 예약된 글만 다시 짠다.
 */

/** 이 시각(KST)까지 나눠 올린다. 밤늦게 몰아서 뜨지 않게. */
const END_HOUR_KST = 22;
/** 밤에 손으로 돌렸을 때도 최소 이만큼은 벌린다. */
const MIN_WINDOW_MS = 3 * 3600_000;
const KST_OFFSET_MS = 9 * 3600_000;

/**
 * 같은 무리가 붙지 않게 세운다. **무리마다 자기 개수에 맞춰 전체 길이에 고르게 편다** —
 * k 번째 글의 자리는 (k + 0.5) / 무리 크기.
 *
 * 예전엔 "남은 게 가장 많은 무리부터" 뽑았는데, 그러면 적은 무리가 앞에서 먼저 바닥나고
 * 많은 무리(영상)가 **끝에 몰린다.** 끝은 가장 늦게 뜨는 글, 곧 피드 맨 위다.
 * 실제로 영상 10개가 피드 꼭대기에 줄줄이 붙었다.
 *
 * 영상이 압도적으로 많으면 영상끼리 붙는 건 피할 수 없다. 다만 고르게 퍼져서
 * 한 곳에 몰리지 않는다(영상 15 · 다른 글 5 → 영상은 많아야 3개씩 붙는다).
 *
 * `sub` 를 주면 무리 안에서 돌아가며 세운다 — AI 글을 한 무리로 묶되 같은 계정이 연달아 나오지 않게.
 * 그 밖에는 무리 안의 순서를 들어온 순서 그대로 둔다(같은 채널의 8강 → 4강 → 결승이 뒤집히지 않게).
 */
export function interleave<T>(items: T[], group: (t: T) => string, sub?: (t: T) => string): T[] {
  const groups = new Map<string, T[]>();
  for (const it of items) {
    const k = group(it);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(it);
  }

  const order = [...groups.keys()];
  const placed: { it: T; pos: number; g: number }[] = [];
  order.forEach((key, g) => {
    const list = sub ? roundRobin(groups.get(key)!, sub) : groups.get(key)!;
    list.forEach((it, k) => placed.push({ it, pos: (k + 0.5) / list.length, g }));
  });
  // 같은 자리면 무리 순서대로 — 크기가 같은 무리들은 A B C A B C 로 돈다.
  placed.sort((a, b) => a.pos - b.pos || a.g - b.g);
  return placed.map((x) => x.it);
}

/** 계정별 줄을 하나씩 번갈아 뽑는다. 계정 안의 순서는 그대로. */
function roundRobin<T>(items: T[], key: (t: T) => string): T[] {
  const lanes = new Map<string, T[]>();
  for (const it of items) {
    const k = key(it);
    if (!lanes.has(k)) lanes.set(k, []);
    lanes.get(k)!.push(it);
  }
  const out: T[] = [];
  const queues = [...lanes.values()];
  for (let i = 0; out.length < items.length; i++) {
    for (const q of queues) if (q[i] !== undefined) out.push(q[i]);
  }
  return out;
}

/**
 * n 개의 시각. 창을 n 칸으로 나누고 칸마다 조금씩 흔든다 — 정확히 47분마다 뜨면 기계 같다.
 * 첫 글도 바로 띄우지 않는다. 잡이 도는 중에 반쯤 뜬 상태를 보이지 않게.
 */
export function slots(n: number, start: Date, end: Date, rand: () => number = Math.random): Date[] {
  if (n === 0) return [];
  const gap = (end.getTime() - start.getTime()) / n;
  return Array.from({ length: n }, (_, i) => {
    const t = start.getTime() + (i + 0.2 + rand() * 0.6) * gap;
    return new Date(Math.round(t / 1000) * 1000);
  });
}

/** 오늘(KST) 밤 10시. 이미 지났거나 너무 가까우면 지금부터 3시간. */
export function windowEnd(now: Date): Date {
  const kst = new Date(now.getTime() + KST_OFFSET_MS);
  const end = new Date(
    Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate(), END_HOUR_KST) - KST_OFFSET_MS,
  );
  return end.getTime() - now.getTime() < MIN_WINDOW_MS ? new Date(now.getTime() + MIN_WINDOW_MS) : end;
}

/**
 * 무리를 나누는 기준. 자동 게시 글은 종류(영상·결과·일정·랭킹)로 나누고, AI 글은 한 무리로 묶는다 —
 * 계정마다 따로 두면 서로 다른 AI 계정 글 셋이 연달아 붙는다. 무리 안에서는 계정을 돌아가며 세운다.
 */
export function groupOf(row: { type: string }): string {
  return row.type === "text" ? "ai" : row.type;
}

export function subOf(row: { author_id: string }): string {
  return row.author_id;
}

/**
 * `since` 이후 새로 올라온 봇 글과, **오늘 창 안에** 예약된 봇 글을 한데 모아 다시 짠다.
 * 여러 번 불러도 된다 — 잡 하나 끝날 때마다 부르면 60초 제한에 걸려 크론이 중간에 죽어도
 * 그때까지 올라온 글은 나눠져 있다.
 *
 * 창 밖(다음 날 이후)에 예약된 글은 건드리지 않는다. 며칠에 걸쳐 미리 넣어 둔 글이
 * 다음 날 아침 하루치로 몰려 버리면 안 된다 — 그 글은 그날 아침 수집 때 그날 몫과 함께 짜인다.
 */
export async function spreadBotPosts(
  db: Sql,
  since: Date,
  now: Date = new Date(),
): Promise<{ count: number; until: Date | null }> {
  const end = windowEnd(now);
  const rows = await db<{ id: string; type: string; author_id: string }[]>`
    select p.id, p.type::text as type, p.author_id
    from posts p
    join accounts a on a.id = p.author_id
    where a.kind = 'bot'
      and p.parent_id is null
      and p.deleted_at is null
      and (
        (p.created_at >= ${since} and p.created_at <= ${now})  -- 방금 올라온 것
        or (p.created_at > ${now} and p.created_at <= ${end})  -- 오늘 안에 뜰 예약
      )
    order by p.created_at, p.id`;
  if (rows.length === 0) return { count: 0, until: null };

  const ordered = interleave(rows, groupOf, subOf);
  const times = slots(ordered.length, now, end);
  const values = ordered.map((r, i) => [r.id, times[i].toISOString()]);

  await db`
    update posts set created_at = v.t::timestamptz
    from (values ${db(values)}) as v(id, t)
    where posts.id = v.id::uuid`;

  return { count: rows.length, until: times[times.length - 1] };
}

/** 관리자 화면·크론 요약에 붙이는 한 줄. */
export function spreadNote(r: { count: number; until: Date | null }): string {
  if (r.count === 0 || !r.until) return "";
  const hhmm = r.until.toLocaleTimeString("ko-KR", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return `봇 글 ${r.count}건을 ${hhmm}까지 나눠 올린다`;
}
