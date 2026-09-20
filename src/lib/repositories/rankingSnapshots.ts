import type { Sql } from "postgres";
import type { PreviousEntry } from "@/lib/ranking";
import type { ScrapedRankingRow, RankingFetchResult } from "@/lib/sources/types";
import type { IsoWeek } from "@/lib/types";

/**
 * 직전 주차를 찾는다. **`week - 1` 을 가정하지 않는다.**
 *
 * 수집이 한 주 실패하면 2주 전이 직전 주차가 된다. 그때 `week - 1` 로 조회하면
 * 아무것도 못 찾고 전원이 NEW 로 나온다 — 피드가 통째로 거짓말을 한다.
 * ISO 주차는 `2026-W07` 처럼 0 을 채우므로 문자열 비교로 정렬이 맞다.
 */
export async function findPreviousWeek(
  db: Sql,
  org: string,
  before: IsoWeek,
): Promise<IsoWeek | null> {
  const rows = await db<{ week: string }[]>`
    select week from ranking_snapshots
    where org = ${org} and week < ${before}
    order by week desc limit 1`;
  return (rows[0]?.week as IsoWeek | undefined) ?? null;
}

export async function loadWeek(
  db: Sql,
  org: string,
  week: IsoWeek,
): Promise<PreviousEntry[]> {
  const rows = await db<{ division: string; player_key: string; rank: number }[]>`
    select division, player_key, rank from ranking_snapshots
    where org = ${org} and week = ${week}`;
  return rows.map((r) => ({
    division: r.division,
    playerKey: r.player_key,
    rank: r.rank,
  }));
}

/** 부서 한 곳의 이번 주 전체 행. 게시 잡이 포스트를 만들 때 쓴다. */
export async function loadDivisionRows(
  db: Sql,
  org: string,
  week: IsoWeek,
  division: string,
): Promise<ScrapedRankingRow[]> {
  const rows = await db<
    {
      division: string;
      rank: number;
      player_key: string;
      player_name: string;
      club: string | null;
      points: string | null;
    }[]
  >`
    select division, rank, player_key, player_name, club, points
    from ranking_snapshots
    where org = ${org} and week = ${week} and division = ${division}
    order by rank asc`;

  return rows.map((r) => ({
    division: r.division,
    rank: r.rank,
    playerKey: r.player_key,
    playerName: r.player_name,
    club: r.club,
    // numeric 은 드라이버가 문자열로 준다. 정밀도 손실을 피하려는 기본 동작이다.
    points: r.points === null ? null : Number(r.points),
    note: null,
  }));
}

/**
 * 최근 주차들의 1위 playerKey 를 직전 주차부터 과거 순으로.
 * "N주 연속 1위" 칩은 한 주만으로는 판단할 수 없다.
 */
export async function loadRecentLeaders(
  db: Sql,
  org: string,
  division: string,
  beforeWeek: IsoWeek,
  weeks = 8,
): Promise<string[]> {
  // 동순위 1위가 여럿일 수 있다. 주차별로 하나만 뽑는다 — 연속 판정엔 영향이 같다.
  const rows = await db<{ player_key: string }[]>`
    select distinct on (week) player_key
    from ranking_snapshots
    where org = ${org} and division = ${division}
      and rank = 1 and week < ${beforeWeek}
    order by week desc, player_key
    limit ${weeks}`;
  return rows.map((r) => r.player_key);
}

/** 이번 주차에 실제로 들어온 부서 목록 */
export async function loadDivisions(
  db: Sql,
  org: string,
  week: IsoWeek,
): Promise<string[]> {
  const rows = await db<{ division: string }[]>`
    select distinct division from ranking_snapshots
    where org = ${org} and week = ${week}
    order by division`;
  return rows.map((r) => r.division);
}

/**
 * 스냅샷을 쓴다. 같은 주차를 다시 수집하면 덮어쓴다 —
 * 대회 결과가 늦게 반영되는 경우가 있어 재수집이 안전해야 한다.
 */
export async function saveSnapshot(
  db: Sql,
  result: RankingFetchResult,
): Promise<number> {
  const rows = result.rows.map((r) => ({
    org: result.org,
    division: r.division,
    week: result.week,
    player_key: r.playerKey,
    player_name: r.playerName,
    club: r.club,
    rank: r.rank,
    points: r.points,
    collected_at: result.collectedAt,
  }));

  await db`
    insert into ranking_snapshots ${db(rows)}
    on conflict (org, division, week, player_key) do update set
      player_name = excluded.player_name,
      club        = excluded.club,
      rank        = excluded.rank,
      points      = excluded.points,
      collected_at = excluded.collected_at`;

  return rows.length;
}
