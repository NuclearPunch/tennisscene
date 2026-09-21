import type { Sql } from "postgres";
import { buildRankingPost } from "@/lib/publish/rankingPost";
import { computeDeltas } from "@/lib/ranking";
import { insertRankingPost, loadSuppressedPlayers } from "@/lib/repositories/posts";
import {
  findPreviousWeek,
  loadDivisionRows,
  loadDivisions,
  loadRecentLeaders,
  loadWeek,
} from "@/lib/repositories/rankingSnapshots";
import { isoWeekOf } from "@/lib/week";
import type { JobReport } from "./types";

const ORG = "kato";
const BOT = "b_rank";

/**
 * 주간 랭킹 게시 — B-1.6
 *
 * DB 에 이미 있는 스냅샷만 읽는다. 스냅샷이 없으면 **실패가 아니라 순서 문제**다 —
 * 수집이 먼저 돌아야 한다. 중복은 `posts_ranking_once_idx` 가 막는다.
 */
export async function runPublish(db: Sql): Promise<JobReport> {
  const lines: string[] = [];
  const week = isoWeekOf(new Date());

  const divisions = await loadDivisions(db, ORG, week);
  if (divisions.length === 0) {
    return {
      job: "publish",
      summary: `${week} 스냅샷이 없다. 수집을 먼저 돌려야 한다`,
      lines,
    };
  }

  const prevWeek = await findPreviousWeek(db, ORG, week);
  const previous = prevWeek ? await loadWeek(db, ORG, prevWeek) : [];
  const suppressed = await loadSuppressedPlayers(db, ORG);
  lines.push(
    `${week} · 부서 ${divisions.length}개 · 비교 ${prevWeek ?? "없음"} · 비공개 ${suppressed.size}명`,
  );

  let inserted = 0;
  let skipped = 0;

  for (const division of divisions) {
    const rows = await loadDivisionRows(db, ORG, week, division);
    const { rows: ranked } = computeDeltas(rows, previous);
    const recentLeaders = await loadRecentLeaders(db, ORG, division, week);

    const post = buildRankingPost({
      org: ORG,
      division,
      week,
      rows: ranked,
      recentLeaders,
      suppressed,
    });
    if (!post) {
      lines.push(`${division}: 게시할 행이 없다 (전원 비공개?)`);
      continue;
    }

    const outcome = await insertRankingPost(db, BOT, post.body, post.payload);
    if (outcome === "inserted") inserted++;
    else skipped++;
    lines.push(`${outcome === "inserted" ? "게시" : "중복"} — ${post.body}`);
  }

  return {
    job: "publish",
    summary: `${week} 랭킹 게시 ${inserted}건 · 중복 ${skipped}건`,
    lines,
  };
}
