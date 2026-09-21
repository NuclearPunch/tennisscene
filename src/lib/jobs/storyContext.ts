import type { Sql } from "postgres";
import type { PlayerRank, PodiumAppearance, RankAt } from "@/lib/publish/resultStory";
import {
  loadDivisionPoints,
  loadPlayerRanks,
  loadPodiumHistory,
} from "@/lib/repositories/posts";
import { isoWeekOf } from "@/lib/week";

/**
 * 해석·포인트 한 줄을 만드는 데 필요한 재료 한 묶음.
 * 게시 잡과 소급 적용 잡이 같은 것을 읽어야 같은 문장이 나온다.
 */
export type StoryContext = {
  history: Map<string, PodiumAppearance[]>;
  ranks: Map<string, PlayerRank>;
  rankAt: RankAt;
  /** 이 대회가 이미 랭킹에 반영됐는지 판단한다. */
  reflected: (endsOn: string | null) => boolean;
  counts: { history: number; ranks: number };
};

/**
 * 규정 4-10: "랭킹 업데이트는 각 대회 종료 후 일주일 이내".
 * 그 안에 끝난 대회는 아직 반영 전으로 보고, 그보다 오래된 대회는 이미 들어간 것으로 본다.
 * **이미 반영된 점수를 다시 더하면 두 번 세는 것이다.**
 */
const UPDATE_WINDOW_DAYS = 7;

export async function loadStoryContext(
  db: Sql,
  org: string,
  now = new Date(),
): Promise<StoryContext> {
  const week = isoWeekOf(now);
  const [history, ranks, divisionPoints] = await Promise.all([
    loadPodiumHistory(db, org),
    loadPlayerRanks(db, org, week),
    loadDivisionPoints(db, org, week),
  ]);

  const rankAt: RankAt = (division, points) => {
    const list = divisionPoints.get(division);
    if (!list) return null;
    // 목록은 점수 내림차순이다. 나보다 높은 사람 수 + 1 이 내 자리다.
    let ahead = 0;
    for (const p of list) {
      if (p > points) ahead++;
      else break;
    }
    return ahead + 1;
  };

  const cutoff = new Date(now.getTime() - UPDATE_WINDOW_DAYS * 86400_000)
    .toISOString()
    .slice(0, 10);

  return {
    history,
    ranks,
    rankAt,
    reflected: (endsOn) => (endsOn ? endsOn < cutoff : true),
    counts: { history: history.size, ranks: ranks.size },
  };
}
