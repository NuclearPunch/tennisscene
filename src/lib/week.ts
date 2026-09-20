import type { IsoWeek } from "./types";

/**
 * ISO 8601 주차. 월요일이 주의 시작이고, 1월 4일이 속한 주가 1주차다.
 * 랭킹 스냅샷의 키라서 로케일에 흔들리면 안 된다 — 직접 계산한다.
 */
export function isoWeekOf(date: Date): IsoWeek {
  // UTC 로 복사해서 시간대 때문에 날짜가 밀리는 걸 막는다
  const d = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  );

  // 목요일이 속한 해가 그 주의 ISO 연도다
  const dayOfWeek = d.getUTCDay() || 7; // 일요일 0 → 7
  d.setUTCDate(d.getUTCDate() + 4 - dayOfWeek);

  const year = d.getUTCFullYear();
  const jan1 = new Date(Date.UTC(year, 0, 1));
  const week = Math.ceil(((d.getTime() - jan1.getTime()) / 86400000 + 1) / 7);

  return `${year}-W${String(week).padStart(2, "0")}`;
}

/** `2026-W37` → `2026 W37`. 로그·디버그용 기술 표기다. */
export function formatIsoWeek(week: IsoWeek): string {
  return week.replace("-W", " W");
}

/** `2026-W37` → `2026년 37주차`. 본문처럼 맥락이 필요한 곳에 쓴다. */
export function formatWeekKo(week: IsoWeek): string {
  const [year, w] = week.split("-W");
  return `${year}년 ${Number(w)}주차`;
}

/** `2026-W37` → `37주차`. 칩처럼 좁은 곳에 쓴다. */
export function formatWeekShort(week: IsoWeek): string {
  return `${Number(week.split("-W")[1])}주차`;
}

export function isValidIsoWeek(week: string): boolean {
  return /^\d{4}-W(0[1-9]|[1-4]\d|5[0-3])$/.test(week);
}
