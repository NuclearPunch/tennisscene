import type { ScrapedRankingRow } from "./sources/types";

/**
 * 순위 변동 계산.
 *
 * 원본 사이트는 "지난주 대비 변동"을 주지 않는다. 주차별 스냅샷을 쌓아서 우리가 계산한다.
 * 이 파일은 DB 를 모른다 — 순수 함수라 픽스처로 검증할 수 있다.
 */

export type PreviousEntry = {
  division: string;
  playerKey: string;
  rank: number;
};

export type RankedRow = ScrapedRankingRow & {
  /**
   * 양수면 상승, 음수면 하락, 0 이면 유지.
   * `null` 은 **비교 불가**이고 신규와 다르다 — 첫 수집이거나 이전 주차가 없을 때다.
   */
  delta: number | null;
  /** 이전 주차에 없던 선수. 비교 불가(`delta === null`)와 구분한다. */
  isNew: boolean;
};

export type DeltaSummary = {
  rows: RankedRow[];
  /** 이전 주차가 있었는지. 없으면 변동을 화면에 표시하지 않는다. */
  comparable: boolean;
  /** 가장 많이 오른 선수. 상승이 없으면 null. */
  topRiser: RankedRow | null;
};

/** 부서가 다르면 다른 랭킹이다. 같은 선수도 부서별로 따로 센다. */
function entryKey(division: string, playerKey: string): string {
  return `${division}::${playerKey}`;
}

/**
 * `previous` 가 비어 있으면 비교하지 않는다.
 *
 * 첫 주차에 전원을 NEW 로 표시하면 "이번 주 새로 진입한 선수"라는 뜻이 무의미해진다.
 * 그래서 비교 불가(`delta: null, isNew: false`)와 신규 진입(`isNew: true`)을 나눈다.
 */
export function computeDeltas(
  current: ScrapedRankingRow[],
  previous: PreviousEntry[],
): DeltaSummary {
  const comparable = previous.length > 0;
  const before = new Map(
    previous.map((p) => [entryKey(p.division, p.playerKey), p.rank]),
  );

  const rows: RankedRow[] = current.map((row) => {
    if (!comparable) {
      return { ...row, delta: null, isNew: false };
    }
    const prevRank = before.get(entryKey(row.division, row.playerKey));
    if (prevRank === undefined) {
      return { ...row, delta: null, isNew: true };
    }
    // 순위는 작을수록 위다. 5위에서 2위로 가면 +3 (상승).
    return { ...row, delta: prevRank - row.rank, isNew: false };
  });

  const topRiser = rows.reduce<RankedRow | null>((best, row) => {
    if (row.delta === null || row.delta <= 0) return best;
    if (!best || best.delta === null) return row;
    return row.delta > best.delta ? row : best;
  }, null);

  return { rows, comparable, topRiser };
}

/** 화면 표기용. `+3` `-1` `NEW` `—` */
export function formatDelta(row: RankedRow): string {
  if (row.isNew) return "NEW";
  if (row.delta === null || row.delta === 0) return "—";
  return row.delta > 0 ? `+${row.delta}` : String(row.delta);
}
