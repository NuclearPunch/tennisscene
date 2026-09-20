import type { RankedRow } from "@/lib/ranking";
import type { RankingEntry, RankingPayload } from "@/lib/types";
import { formatWeekKo } from "@/lib/week";

/**
 * 스냅샷을 랭킹 포스트로 바꾼다. DB 를 모르는 순수 함수다.
 *
 * 단체×부서마다 별도 포스트다. 부수 체계가 서로 다른 축이라 합산할 수 없다
 * (docs/DECISIONS.md). 한 포스트가 한 랭킹만 말한다.
 */

/** 2~10위. 카드는 기본 3명만 보여주고 나머지는 더보기로 편다. */
const RUNNERS_UP = 9;
/** 이 이상 뛰어야 "지난주 N위 → 1위"를 붙인다. 1~2계단은 이야깃거리가 아니다. */
const BIG_JUMP = 5;
/** 이 이상이어야 "N주 연속"을 붙인다. 2주는 연속이라 부르기 민망하다. */
const MIN_STREAK = 3;

export type BuildInput = {
  org: string;
  division: string;
  week: string;
  /** 해당 부서 행만. rank 오름차순. */
  rows: RankedRow[];
  /** 직전 주차부터 과거로 내려가는 각 주차의 1위 playerKey. */
  recentLeaders: string[];
  /** 이름 비공개가 승인된 선수의 playerKey. 발행 전에 걸러낸다. */
  suppressed?: ReadonlySet<string>;
};

export type BuiltPost = {
  payload: RankingPayload;
  body: string;
};

function toEntry(row: RankedRow): RankingEntry {
  return {
    rank: row.rank,
    playerKey: row.playerKey,
    name: row.playerName,
    club: row.club,
    delta: row.delta,
    isNew: row.isNew,
    points: row.points,
  };
}

/** 직전 주차부터 몇 주 연속 1위였나. 이번 주는 세지 않는다. */
function streakOf(playerKey: string, recentLeaders: string[]): number {
  let n = 0;
  for (const leader of recentLeaders) {
    if (leader !== playerKey) break;
    n += 1;
  }
  return n;
}

/**
 * 스토리 칩. 위에서부터 먼저 맞는 것 하나만 쓴다.
 * 없으면 null — 억지로 채우면 매주 같은 말을 하게 된다.
 */
function storyFor(leader: RankedRow, recentLeaders: string[]): string | null {
  if (leader.isNew) return "이번 주 새로 진입";

  if (leader.delta !== null && leader.delta >= BIG_JUMP) {
    // 순위는 작을수록 위다. 지난주 순위 = 이번주 + 상승폭.
    return `지난주 ${leader.rank + leader.delta}위 → 1위`;
  }

  // 이번 주를 포함한 연속 횟수
  const streak = streakOf(leader.playerKey, recentLeaders) + 1;
  if (streak >= MIN_STREAK) return `${streak}주 연속 1위`;

  return null;
}

export function buildRankingPost(input: BuildInput): BuiltPost | null {
  const suppressed = input.suppressed ?? new Set<string>();

  // 이름 비공개가 승인된 선수는 발행 전에 뺀다.
  // 한 번 payload 에 박히면 소급 마스킹(B-5.2)이 필요해진다.
  const visible = input.rows
    .filter((r) => !suppressed.has(r.playerKey))
    .sort((a, b) => a.rank - b.rank);

  if (visible.length === 0) return null;

  const leader = visible[0];
  const story = storyFor(leader, input.recentLeaders);

  const payload: RankingPayload = {
    org: input.org,
    division: input.division,
    // 카토 데이터에는 지역이 없다. 소속 클럽에 섞여 있지만 규칙적이지 않다.
    region: null,
    week: input.week,
    leader: toEntry(leader),
    runnersUp: visible.slice(1, 1 + RUNNERS_UP).map(toEntry),
    story,
  };

  const label = `${formatWeekKo(input.week)} ${input.division}부`;
  const body = story
    ? `${label} 1위는 ${leader.playerName} 선수. ${story}입니다.`
    : `${label} 1위는 ${leader.playerName} 선수입니다.`;

  return { payload, body };
}
