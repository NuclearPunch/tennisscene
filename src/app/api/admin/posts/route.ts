import { NextResponse } from "next/server";
import { fail, isCaller, requireAdmin } from "@/lib/api";

export const dynamic = "force-dynamic";

/** 최근 글. 관리자가 숨긴 글도 같이 준다 — 그래야 되살릴 수 있다. */
export async function GET(request: Request) {
  const caller = await requireAdmin(request);
  if (!isCaller(caller)) return caller;

  const before = new URL(request.url).searchParams.get("before");
  const { data, error } = await caller.db.rpc("admin_recent_posts", {
    before: before && !Number.isNaN(Date.parse(before)) ? before : null,
    lim: 30,
  });
  if (error) {
    console.error("글 목록 실패", error);
    return fail(500, "글 목록을 못 읽었습니다");
  }
  return NextResponse.json({ posts: data });
}
