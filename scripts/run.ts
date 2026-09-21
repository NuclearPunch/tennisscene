/**
 * 잡 스크립트의 공통 꼬리. 리포트를 찍고 종료 코드를 정한다.
 *
 * 종료 코드를 나누는 이유: 크론이나 CI 가 "구조가 바뀌었다"와 "네트워크가 끊겼다"를
 * 구분할 수 있어야 한다. 앞의 것은 사람이 파서를 고쳐야 하고, 뒤의 것은 다시 돌리면 된다.
 */
import type { Sql } from "postgres";
import { jobDb } from "../src/lib/db";
import type { JobReport } from "../src/lib/jobs/types";
import { SourceStructureError } from "../src/lib/sources/types";

export function print(report: JobReport) {
  for (const line of report.lines) console.log(`  ${line}`);
  console.log(`\n${report.summary}`);
}

export function bail(err: unknown): never {
  if (err instanceof SourceStructureError) {
    // 구조가 바뀌면 저장하지 않는다. 잘못된 데이터를 피드에 올리는 것보다 그날 포스트가 없는 게 낫다.
    console.error(`[구조 변경] ${err.org}: ${err.message}`);
    process.exit(2);
  }
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}

/** DB 를 열고 잡을 돌린 뒤 반드시 닫는다. */
export async function withDb(fn: (db: Sql) => Promise<JobReport>) {
  const db = jobDb();
  try {
    print(await fn(db));
  } finally {
    await db.end();
  }
}
