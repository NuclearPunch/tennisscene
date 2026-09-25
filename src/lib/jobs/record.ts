import type { Sql } from "postgres";
import { recordJobRun } from "@/lib/repositories/jobRuns";
import { SourceStructureError } from "@/lib/sources/types";
import type { Job, JobReport } from "./types";

export type RunOutcome =
  | { ok: true; report: JobReport; ms: number }
  | { ok: false; job: string; reason: string; structural: boolean; ms: number };

/**
 * 잡 하나를 돌리고 결과를 `job_runs` 에 남긴다. 크론과 관리자 "지금 돌리기" 가 같이 쓴다.
 *
 * 던지지 않는다. 한 잡이 죽어도 부르는 쪽이 다음 잡으로 넘어갈 수 있어야 한다.
 */
export async function runAndRecord(
  db: Sql,
  name: string,
  job: Job,
  trigger: "cron" | "manual",
  runBy: string | null = null,
): Promise<RunOutcome> {
  const startedAt = new Date();
  try {
    const report = await job(db);
    const ms = Date.now() - startedAt.getTime();
    await recordJobRun(db, {
      job: name, trigger, ok: true, summary: report.summary, lines: report.lines,
      durationMs: ms, startedAt, runBy,
    });
    return { ok: true, report, ms };
  } catch (err) {
    const ms = Date.now() - startedAt.getTime();
    const structural = err instanceof SourceStructureError;
    const reason = err instanceof Error ? err.message : String(err);
    await recordJobRun(db, {
      job: name, trigger, ok: false,
      summary: `${structural ? "소스 구조가 바뀐 것 같다 — " : ""}${reason}`,
      lines: [], durationMs: ms, startedAt, runBy,
    });
    return { ok: false, job: name, reason, structural, ms };
  }
}
