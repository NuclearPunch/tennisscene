import type { Sql } from "postgres";

/**
 * 수집·게시 잡의 알맹이. **CLI 와 크론이 같은 함수를 부른다.**
 *
 * 스크립트에만 두면 서버리스에서 못 부르고, 라우트에만 두면 손으로 못 돌린다.
 * `--dry-run` `--fixture` `--sql` 처럼 DB 를 안 건드리는 경로는 스크립트에 남겨둔다.
 *
 * 잡은 `process.exit` 을 부르지 않는다 — 크론 핸들러를 통째로 죽인다.
 * 구조가 바뀌면 `SourceStructureError` 를 던지고, 부르는 쪽이 어떻게 할지 정한다.
 */
export type JobReport = {
  /** 크론 로그에서 어느 잡인지 찾는 이름 */
  job: string;
  /** 사람이 읽는 한 줄 요약 */
  summary: string;
  /** 자세한 기록. CLI 는 그대로 출력하고, 크론은 응답에 담는다. */
  lines: string[];
};

export type Job = (db: Sql) => Promise<JobReport>;
