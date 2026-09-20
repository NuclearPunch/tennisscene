import type { SupabaseClient } from "@supabase/supabase-js";
import type { PreviousEntry } from "@/lib/ranking";
import type { RankingFetchResult } from "@/lib/sources/types";
import type { IsoWeek } from "@/lib/types";

const TABLE = "ranking_snapshots";

/**
 * 직전 주차를 찾는다. **`week - 1` 을 가정하지 않는다.**
 *
 * 수집이 한 주 실패하면 2주 전이 직전 주차가 된다. 그때 `week - 1` 로 조회하면
 * 아무것도 못 찾고 전원이 NEW 로 나온다 — 피드가 통째로 거짓말을 한다.
 * ISO 주차 문자열은 `2026-W07` 처럼 0 을 채우므로 문자열 비교로 정렬이 맞다.
 */
export async function findPreviousWeek(
  db: SupabaseClient,
  org: string,
  before: IsoWeek,
): Promise<IsoWeek | null> {
  const { data, error } = await db
    .from(TABLE)
    .select("week")
    .eq("org", org)
    .lt("week", before)
    .order("week", { ascending: false })
    .limit(1);

  if (error) throw error;
  return (data?.[0]?.week as IsoWeek | undefined) ?? null;
}

export async function loadWeek(
  db: SupabaseClient,
  org: string,
  week: IsoWeek,
): Promise<PreviousEntry[]> {
  const { data, error } = await db
    .from(TABLE)
    .select("division, player_key, rank")
    .eq("org", org)
    .eq("week", week);

  if (error) throw error;
  return (data ?? []).map((r) => ({
    division: r.division as string,
    playerKey: r.player_key as string,
    rank: r.rank as number,
  }));
}

/**
 * 스냅샷을 쓴다. 같은 주차를 다시 수집하면 덮어쓴다 —
 * 대회 결과가 늦게 반영되는 경우가 있어 재수집이 안전해야 한다.
 */
export async function saveSnapshot(
  db: SupabaseClient,
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

  const { error } = await db
    .from(TABLE)
    .upsert(rows, { onConflict: "org,division,week,player_key" });

  if (error) throw error;
  return rows.length;
}
