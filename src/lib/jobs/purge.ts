import type { Sql } from "postgres";
import { PURGE_AFTER_DAYS } from "@/lib/legal";
import type { JobReport } from "./types";

/** 수집 기록은 이만큼만 둔다. 관리자 화면이 최근 것만 보고, 오래된 기록은 쓸 데가 없다. */
const JOB_RUNS_KEEP_DAYS = 180;

/**
 * 내린 글을 완전히 지운다 — 개인정보 처리방침 3번("내린 글·댓글과 신고 기록은 1년 보관 뒤 완전히 삭제").
 *
 * 탈퇴·작성자 삭제·관리자 숨김·자동 블라인드 모두 `deleted_at` 을 채우는 soft delete 다.
 * 그 뒤 {PURGE_AFTER_DAYS}일이 지나면 행을 지운다. 달린 댓글, 신고, 숨김 기록, 좋아요는
 * 외래키(on delete cascade)로 같이 지워진다.
 *
 * 방침에 적어 놓고 안 지우면 방침이 거짓말이 된다. 그래서 매일 돈다.
 */
export async function runPurge(db: Sql): Promise<JobReport> {
  const posts = await db`
    delete from posts
    where deleted_at is not null
      and deleted_at < now() - make_interval(days => ${PURGE_AFTER_DAYS})
    returning id`;
  const runs = await db`
    delete from job_runs
    where started_at < now() - make_interval(days => ${JOB_RUNS_KEEP_DAYS})
    returning id`;
  return {
    job: "purge",
    summary: `내린 지 ${PURGE_AFTER_DAYS}일 지난 글 ${posts.length}건 · 오래된 수집 기록 ${runs.length}건을 지웠다`,
    lines: [],
  };
}
