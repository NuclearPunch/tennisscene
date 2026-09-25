import type { Sql } from "postgres";

/**
 * 잡 한 번 돈 기록. 관리자 화면의 "수집 기록" 이 읽는다.
 *
 * 기록이 실패해도 잡은 성공이다 — 기록 테이블 때문에 크론 전체가 죽으면 본말전도다.
 * 그래서 여기서 삼키고 로그만 남긴다.
 */
export async function recordJobRun(
  db: Sql,
  run: {
    job: string;
    trigger: "cron" | "manual";
    ok: boolean;
    summary: string;
    lines: string[];
    durationMs: number;
    startedAt: Date;
    runBy?: string | null;
  },
): Promise<void> {
  try {
    await db`
      insert into job_runs (job, trigger, ok, summary, lines, duration_ms, started_at, run_by)
      values (
        ${run.job}, ${run.trigger}, ${run.ok}, ${run.summary},
        ${db.json(run.lines.slice(0, 200))}, ${run.durationMs}, ${run.startedAt}, ${run.runBy ?? null}
      )`;
  } catch (err) {
    console.error(`[job_runs] 기록 실패: ${err instanceof Error ? err.message : err}`);
  }
}
