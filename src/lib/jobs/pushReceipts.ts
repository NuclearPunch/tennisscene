import type { Sql } from "postgres";
import { checkReceipts } from "@/lib/push";
import type { JobReport } from "./types";

/** 어제 보낸 알림의 전달 결과를 보고, 앱을 지운 기기의 토큰을 지운다. */
export async function runPushReceipts(db: Sql): Promise<JobReport> {
  const r = await checkReceipts(db);
  return { job: "push", summary: `알림 영수증 ${r.checked}건 확인 · 사라진 기기 ${r.dropped}건 정리`, lines: [] };
}
