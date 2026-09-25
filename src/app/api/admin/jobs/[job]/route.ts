import { NextResponse } from "next/server";
import { fail, isCaller, requireAdmin } from "@/lib/api";
import { jobDb } from "@/lib/db";
import { runAiPosts } from "@/lib/jobs/aiPosts";
import { runAndRecord } from "@/lib/jobs/record";
import { runResults } from "@/lib/jobs/results";
import { spreadBotPosts, spreadNote } from "@/lib/jobs/schedule";
import { runTournaments } from "@/lib/jobs/tournaments";
import { runYoutube } from "@/lib/jobs/youtube";
import type { Job } from "@/lib/jobs/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * 손으로 돌릴 수 있는 잡. 매일 도는 것들만이다.
 *
 * **랭킹 스냅샷·게시는 뺀다.** 주간 다이제스트라(CLAUDE.md 규칙 3) 월요일 크론만 돌린다.
 * 멱등이라 두 번 돌아도 두 번 안 올라가지만, 화요일에 누르면 지난주 랭킹이 "이번 주" 로 뜬다.
 */
const RUNNABLE: Record<string, Job> = {
  youtube: runYoutube,
  tournaments: runTournaments,
  results: runResults,
  ai: runAiPosts,
};

/**
 * 지금 돌리기. 잡은 직접 연결로 돌아서 **DB 가 사람을 모른다** —
 * 그래서 requireAdmin 이 유일한 문이다. 빼면 누구나 카토에 요청을 쏟아붓게 된다.
 */
export async function POST(request: Request, ctx: { params: Promise<{ job: string }> }) {
  const caller = await requireAdmin(request);
  if (!isCaller(caller)) return caller;
  const { job } = await ctx.params;

  const run = RUNNABLE[job];
  if (!run) return fail(404, "손으로 돌릴 수 없는 잡입니다");

  const db = jobDb();
  const started = new Date();
  try {
    const out = await runAndRecord(db, job, run, "manual", caller.accountId);
    // 손으로 돌려도 한꺼번에 올리지 않는다. 오늘 밤까지 나눠 올리고, 그렇다고 알려준다.
    const note = spreadNote(await spreadBotPosts(db, started));
    return out.ok
      ? NextResponse.json({ ok: true, summary: [out.report.summary, note].filter(Boolean).join(" · "), ms: out.ms })
      : NextResponse.json({ ok: false, summary: out.reason, ms: out.ms }, { status: 502 });
  } finally {
    await db.end();
  }
}
