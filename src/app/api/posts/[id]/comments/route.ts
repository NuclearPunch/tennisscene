import { after, NextResponse } from "next/server";
import { fail, failIfSuspended, isCaller, requireAccount } from "@/lib/api";
import { jobDb } from "@/lib/db";
import { validatePostInput } from "@/lib/postInput";
import { notifyReply } from "@/lib/push";

export const dynamic = "force-dynamic";

/**
 * 댓글 달기 — B-3.6
 *
 * 댓글도 `posts` 한 행이다. `parent_id` 가 있을 뿐 타입은 똑같이 `text` 다.
 * **1단계만 허용한다.** 대댓글은 DB 트리거가 거부한다(posts_enforce_reply_depth).
 * 본문 검사는 글쓰기와 같은 함수를 쓴다 — 500자 한도가 두 곳에서 어긋나면 안 된다.
 */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const caller = await requireAccount(request);
  if (!isCaller(caller)) return caller;
  const { id } = await ctx.params;

  const checked = validatePostInput(await request.json().catch(() => null));
  if (!checked.ok) return fail(400, checked.reason);
  const suspended = await failIfSuspended(caller.db);
  if (suspended) return suspended;

  const { data, error } = await caller.db
    .from("posts")
    .insert({
      author_id: caller.accountId,
      type: "text",
      body: checked.value.body,
      is_anonymous: checked.value.isAnonymous,
      parent_id: id,
    })
    // base 테이블은 컬럼 단위 권한이라 `*` 로 돌려받으면 42501 이 난다.
    .select("id, created_at")
    .single();

  if (error) {
    // 부모를 못 찾으면 트리거가 foreign_key_violation 으로 돌려준다.
    if (error.code === "23503") return fail(404, "없는 글입니다");
    if (error.code === "23514") return fail(400, "댓글에는 답글을 달 수 없습니다");
    console.error("댓글 저장 실패", error);
    return fail(500, "댓글을 올리지 못했습니다");
  }

  // 글쓴이에게 알린다. 응답을 보낸 뒤에 한다 — 알림 서버가 느려도 댓글 저장이 늦어지면 안 된다.
  // 토큰은 아무도 읽을 수 없는 테이블이라 서버 직접 연결로 찾는다.
  after(async () => {
    const db = jobDb();
    try {
      await notifyReply(db, {
        parentId: id,
        commenterId: caller.accountId,
        anonymous: checked.value.isAnonymous,
        body: checked.value.body,
      });
    } catch (err) {
      console.error("[push] 댓글 알림 실패", err instanceof Error ? err.message : err);
    } finally {
      await db.end();
    }
  });

  return NextResponse.json({ id: data.id, createdAt: data.created_at }, { status: 201 });
}
