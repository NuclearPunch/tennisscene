import type { Sql } from "postgres";
import { computeDeltas, formatDelta } from "@/lib/ranking";
import {
  findPreviousWeek,
  loadWeek,
  saveSnapshot,
} from "@/lib/repositories/rankingSnapshots";
import { katoSource } from "@/lib/sources/kato";
import type { JobReport } from "./types";

/**
 * 주차 스냅샷 저장 — B-1.2
 *
 * **놓치면 그 주는 영영 없다.** 카토는 현재 순위만 보여주고 과거 조회가 없다.
 * 게다가 `findPreviousWeek` 는 "직전에 있는 주차"를 찾으므로, 한 주를 건너뛰면
 * 그다음 주 변동이 2주치 변동인데 한 주치인 척하게 된다.
 *
 * 게시(B-1.6)와 분리돼 있다. 이 잡은 스냅샷만 쌓는다.
 */
export async function runSnapshot(db: Sql): Promise<JobReport> {
  const lines: string[] = [];
  const result = katoSource.parse(await katoSource.fetchRaw());
  lines.push(`${result.org} · ${result.week} · ${result.rows.length}행 수집`);

  const prevWeek = await findPreviousWeek(db, result.org, result.week);
  const previous = prevWeek ? await loadWeek(db, result.org, prevWeek) : [];
  lines.push(
    prevWeek
      ? `직전 주차 ${prevWeek} · ${previous.length}행과 비교한다`
      : "직전 주차가 없다. 이번 주는 변동을 표시하지 않는다",
  );

  const saved = await saveSnapshot(db, result);
  lines.push(`스냅샷 ${saved}행 저장`);

  const { rows, comparable, topRiser } = computeDeltas(result.rows, previous);
  if (!comparable) {
    return { job: "snapshot", summary: `${result.week} 스냅샷 ${saved}행 (첫 주차)`, lines };
  }

  const moved = rows.filter((r) => r.delta !== null && r.delta !== 0);
  const entered = rows.filter((r) => r.isNew);
  lines.push(`변동 ${moved.length}건 · 신규 진입 ${entered.length}명`);
  if (topRiser) {
    lines.push(
      `최대 상승 ${topRiser.playerName} (${topRiser.division}) ${formatDelta(topRiser)}`,
    );
  }

  return {
    job: "snapshot",
    summary: `${result.week} 스냅샷 ${saved}행 · 변동 ${moved.length}건`,
    lines,
  };
}
