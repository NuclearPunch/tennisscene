import { NextResponse } from "next/server";
import { fail, isCaller, requireAdmin } from "@/lib/api";

export const dynamic = "force-dynamic";

/**
 * 숨기기·되살리기. 둘 다 DB 함수가 관리자인지 다시 본다.
 * 되살리기는 **관리자가 숨긴 글만** 된다 — 작성자가 스스로 지운 글은 DB 가 거절한다.
 */
export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const caller = await requireAdmin(request);
  if (!isCaller(caller)) return caller;
  const { id } = await ctx.params;

  const body = (await request.json().catch(() => null)) as { hidden?: unknown; reason?: unknown } | null;
  if (typeof body?.hidden !== "boolean") return fail(400, "hidden 이 필요합니다");

  const { error } = body.hidden
    ? await caller.db.rpc("admin_hide_post", {
        target: id,
        why: typeof body.reason === "string" ? body.reason.slice(0, 300) : null,
      })
    : await caller.db.rpc("admin_restore_post", { target: id });

  if (error) {
    if (error.code === "P0002") return fail(404, error.message);
    if (error.code === "42501") return fail(403, error.message);
    if (error.code === "22P02") return fail(400, "글 ID 가 이상합니다");
    console.error("숨기기 실패", error);
    return fail(500, "바꾸지 못했습니다");
  }
  return NextResponse.json({ id, hidden: body.hidden });
}
