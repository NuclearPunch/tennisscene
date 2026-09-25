import { NextResponse } from "next/server";
import { fail, isCaller, requireAdmin } from "@/lib/api";

export const dynamic = "force-dynamic";

/** 이 글을 쓴 회원의 이용을 정지한다(약관 5·6조). 익명 글이어도 된다. 권한은 DB 함수가 다시 본다. */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const caller = await requireAdmin(request);
  if (!isCaller(caller)) return caller;
  const { id } = await ctx.params;
  const body = (await request.json().catch(() => null)) as { reason?: unknown } | null;

  const { data, error } = await caller.db.rpc("admin_suspend_author", {
    target: id,
    why: typeof body?.reason === "string" ? body.reason.slice(0, 300) : null,
  });
  if (error) {
    if (error.code === "42501") return fail(403, error.message);
    if (error.code === "22023" || error.code === "P0002") return fail(400, error.message);
    console.error("정지 실패", error);
    return fail(500, "정지하지 못했습니다");
  }
  return NextResponse.json({ handle: data });
}
