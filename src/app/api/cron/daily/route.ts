import { NextResponse } from "next/server";
import { jobDb } from "@/lib/db";
import { runPublish } from "@/lib/jobs/publish";
import { runResults } from "@/lib/jobs/results";
import { runSnapshot } from "@/lib/jobs/snapshot";
import { runTournaments } from "@/lib/jobs/tournaments";
import type { Job, JobReport } from "@/lib/jobs/types";
import { SourceStructureError } from "@/lib/sources/types";

export const dynamic = "force-dynamic";
/**
 * 결과 잡이 카토에 예의를 지키느라 요청 사이에 350ms 씩 쉰다. 월요일(랭킹까지 도는 날)
 * 실측 22초. 60 은 Vercel 무료 플랜의 상한이기도 하다 — 유료로 올려야 더 줄 수 있다.
 */
export const maxDuration = 60;

/**
 * 하루 한 번 도는 수집·게시 잡 — B-5.3
 *
 * **크론 하나에 다 넣은 이유:** Vercel 무료 플랜은 크론을 2개까지, 하루 1회만 준다.
 * 잡마다 크론을 따로 두면 유료 플랜이 필요하다. 요일 분기는 여기서 한다.
 * 유료로 올리면 vercel.json 에서 쪼개면 되고, 잡 함수는 그대로 쓴다.
 *
 * **아침 09시(KST)에 도는 이유:** 대회 결과는 경기가 끝난 저녁에 입력된다.
 * 저녁에 돌리면 그날 입력분을 놓치고 하루를 통째로 미루게 된다.
 *
 * **모든 잡이 멱등이다.** 두 번 돌아도 포스트가 두 번 안 생긴다 —
 * 스냅샷은 upsert 이고, 게시는 부분 유니크 인덱스가 막는다.
 * 그래서 실패한 날 손으로 다시 돌려도 안전하다.
 */

/** 크론은 UTC 로 돈다. 요일 분기는 한국 시각으로 해야 한다. */
const KST_OFFSET_MS = 9 * 3600_000;
function kstWeekday(now: Date): number {
  return new Date(now.getTime() + KST_OFFSET_MS).getUTCDay(); // 0=일 … 1=월
}

export async function GET(request: Request) {
  // Vercel 크론은 CRON_SECRET 을 Authorization 으로 보낸다.
  // 없으면 누구나 이 주소를 두드려 카토에 요청을 쏟아부을 수 있다.
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("CRON_SECRET 이 없다. 크론을 돌리지 않는다.");
    return NextResponse.json({ error: "설정되지 않았습니다" }, { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "권한이 없습니다" }, { status: 401 });
  }

  const now = new Date();
  const monday = kstWeekday(now) === 1;

  // 랭킹은 주간 다이제스트다(CLAUDE.md 규칙 3). 월요일에만 뜨고 게시한다.
  // 수집을 먼저 한 뒤 게시해야 그 주 스냅샷을 읽는다.
  const jobs: [string, Job][] = [
    ...(monday
      ? ([
          ["snapshot", runSnapshot],
          ["publish", runPublish],
        ] as [string, Job][])
      : []),
    ["tournaments", runTournaments],
    ["results", runResults],
  ];

  const db = jobDb();
  const done: JobReport[] = [];
  const failed: { job: string; reason: string; structural: boolean }[] = [];

  try {
    for (const [name, job] of jobs) {
      try {
        const report = await job(db);
        done.push(report);
        console.log(`[cron] ${report.summary}`);
      } catch (err) {
        // 한 잡이 죽어도 나머지는 돌린다. 카토가 랭킹 페이지만 바꿨는데
        // 대회 결과까지 못 올리면 손해가 두 배다.
        const structural = err instanceof SourceStructureError;
        const reason = err instanceof Error ? err.message : String(err);
        failed.push({ job: name, reason, structural });
        console.error(`[cron] ${name} 실패${structural ? " (구조 변경)" : ""}: ${reason}`);
      }
    }
  } finally {
    await db.end();
  }

  // 실패해도 200 을 준다. Vercel 은 실패한 크론을 재시도하지 않으므로 상태 코드로 얻을 게 없고,
  // 본문에 남겨두면 대시보드 로그에서 무엇이 왜 죽었는지 바로 읽힌다.
  return NextResponse.json({
    ranAt: now.toISOString(),
    weekly: monday,
    done: done.map((r) => ({ job: r.job, summary: r.summary })),
    failed,
  });
}
