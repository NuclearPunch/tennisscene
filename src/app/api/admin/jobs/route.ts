import { NextResponse } from "next/server";
import { fail, isCaller, requireAdmin } from "@/lib/api";

export const dynamic = "force-dynamic";

/** 최근 수집 기록. 크론이 오늘 돌았는지, 무엇이 실패했는지. */
export async function GET(request: Request) {
  const caller = await requireAdmin(request);
  if (!isCaller(caller)) return caller;

  const { data, error } = await caller.db
    .from("job_runs")
    .select("id, job, trigger, ok, summary, lines, duration_ms, started_at")
    .order("started_at", { ascending: false })
    .limit(60);
  if (error) {
    console.error("수집 기록 실패", error);
    return fail(500, "수집 기록을 못 읽었습니다");
  }
  return NextResponse.json({ runs: data });
}
