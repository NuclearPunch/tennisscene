import { NextResponse } from "next/server";
import { fail, isCaller, requireAccount } from "@/lib/api";

export const dynamic = "force-dynamic";

/**
 * 좋아요 켜기(PUT) · 끄기(DELETE).
 *
 * 토글 하나로 만들지 않는다. 빠르게 두 번 누르면 어느 쪽이 먼저 닿는지에 따라
 * 결과가 달라진다. PUT·DELETE 는 몇 번을 보내도 같은 자리에 머문다.
 * 카운터는 DB 트리거가 센다 — 애플리케이션이 만지지 않는다.
 */
type Ctx = { params: Promise<{ id: string }> };

export async function PUT(request: Request, ctx: Ctx) {
  const caller = await requireAccount(request);
  if (!isCaller(caller)) return caller;
  const { id } = await ctx.params;

  const { error } = await caller.db
    .from("likes")
    .insert({ account_id: caller.accountId, post_id: id });

  // 이미 눌러둔 상태다. 실패가 아니라 이미 원하는 자리에 있는 것이다.
  if (error && error.code !== "23505") {
    if (error.code === "23503") return fail(404, "없는 글입니다");
    console.error("like 실패", error);
    return fail(500, "좋아요를 저장하지 못했습니다");
  }
  return NextResponse.json({ on: true });
}

export async function DELETE(request: Request, ctx: Ctx) {
  const caller = await requireAccount(request);
  if (!isCaller(caller)) return caller;
  const { id } = await ctx.params;

  const { error } = await caller.db
    .from("likes")
    .delete()
    .eq("account_id", caller.accountId)
    .eq("post_id", id);

  if (error) {
    console.error("like 취소 실패", error);
    return fail(500, "좋아요를 취소하지 못했습니다");
  }
  return NextResponse.json({ on: false });
}
