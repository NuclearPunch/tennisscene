import type { TournamentPayload } from "@/lib/types";
import type { TournamentStub } from "@/lib/sources/katoTournaments";

/**
 * 접수가 열린 대회를 포스트로. DB 를 모르는 순수 함수다.
 *
 * 접수 마감일은 담지 않는다. 요강이 자유 텍스트라 못 읽을 때가 있고,
 * **틀린 마감일은 없는 것보다 나쁘다** — 마감을 놓치게 만든다.
 * 대신 상세 페이지 링크를 준다.
 */

const BASE_URL = process.env.KATO_BASE_URL ?? "https://kato.kr";

export type BuiltTournamentPost = {
  payload: TournamentPayload;
  body: string;
};

/** `2026-09-17` → `09.17 (목)` */
function dayLabel(iso: string): string {
  // UTC 자정으로 만들고 UTC 로 읽는다. KST 로 만들어 UTC 로 읽으면 9시간만큼
  // 하루가 밀려서 요일이 틀린다. 날짜 문자열의 요일은 시간대와 무관해야 한다.
  const d = new Date(`${iso}T00:00:00Z`);
  const dow = ["일", "월", "화", "수", "목", "금", "토"][d.getUTCDay()];
  return `${iso.slice(5, 7)}.${iso.slice(8, 10)} (${dow})`;
}

export function buildTournamentPost(
  stub: TournamentStub,
  venue: string | null,
  org = "kato",
): BuiltTournamentPost {
  const payload: TournamentPayload = {
    org,
    sourceId: stub.sourceId,
    name: stub.name,
    grade: stub.grade,
    venue,
    startsOn: stub.startDate,
    endsOn: stub.endDate,
    divisions: stub.divisions,
    status: stub.status,
    sourceUrl: `${BASE_URL}/openGame/${stub.sourceId}`,
  };

  const when =
    stub.startDate === stub.endDate
      ? dayLabel(stub.startDate)
      : `${dayLabel(stub.startDate)} — ${dayLabel(stub.endDate)}`;

  const where = venue ? ` ${venue}에서 열립니다.` : "";
  const body = `${stub.name} 접수가 시작됐습니다. ${when}${where}`;

  return { payload, body };
}
