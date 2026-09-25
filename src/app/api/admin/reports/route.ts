import { NextResponse } from "next/server";
import { fail, isCaller, requireAdmin } from "@/lib/api";

export const dynamic = "force-dynamic";

/** 신고가 열려 있는 글. 글마다 한 줄, 신고 많은 순. 권한은 DB 함수가 다시 본다. */
export async function GET(request: Request) {
  const caller = await requireAdmin(request);
  if (!isCaller(caller)) return caller;
  const { data, error } = await caller.db.rpc("admin_report_queue");
  if (error) {
    console.error("신고 큐 실패", error);
    return fail(500, "신고 목록을 못 읽었습니다");
  }
  return NextResponse.json({ reports: data });
}
