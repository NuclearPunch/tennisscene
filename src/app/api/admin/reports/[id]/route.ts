import { NextResponse } from "next/server";
import { fail, isCaller, requireAdmin } from "@/lib/api";

export const dynamic = "force-dynamic";

/**
 * 신고 처리. remove = 내림 확정, keep = 문제없음(자동으로 가려졌으면 되살린다).
 * 그 글의 열린 신고를 전부 닫는다.
 */
export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const caller = await requireAdmin(request);
  if (!isCaller(caller)) return caller;
  const { id } = await ctx.params;
  const body = (await request.json().catch(() => null)) as { verdict?: unknown; note?: unknown } | null;
  if (body?.verdict !== "remove" && body?.verdict !== "keep") return fail(400, "verdict 는 remove 또는 keep 입니다");

  const { error } = await caller.db.rpc("admin_resolve_reports", {
    target: id,
    verdict: body.verdict,
    note: typeof body.note === "string" ? body.note.slice(0, 300) : null,
  });
  if (error) {
    if (error.code === "42501") return fail(403, error.message);
    if (error.code === "22P02") return fail(400, "글 ID 가 이상합니다");
    console.error("신고 처리 실패", error);
    return fail(500, "처리하지 못했습니다");
  }
  return NextResponse.json({ id, verdict: body.verdict });
}
