import type { Sql } from "postgres";
import type { RankingPayload, TournamentPayload } from "@/lib/types";

// postgres.js 의 json 헬퍼는 구조적 타입을 받는다. payload 는 평범한 객체라 그대로 넘어간다.

/** 랭킹 포스트를 쓴다. 이미 같은 단체·부서·주차가 있으면 조용히 건너뛴다. */
export async function insertRankingPost(
  db: Sql,
  authorId: string,
  body: string,
  payload: RankingPayload,
): Promise<"inserted" | "duplicate"> {
  try {
    await db`
      insert into posts (author_id, type, body, payload)
      values (${authorId}, 'ranking', ${body}, ${db.json(payload)})`;
    return "inserted";
  } catch (err) {
    // posts_ranking_once_idx 위반. 게시 잡을 두 번 돌린 것뿐이라 실패가 아니다.
    if ((err as { code?: string }).code === "23505") return "duplicate";
    throw err;
  }
}

/** 이름 비공개가 승인된 선수. 발행 전에 걸러내려고 읽는다. */
export async function loadSuppressedPlayers(
  db: Sql,
  org: string,
): Promise<Set<string>> {
  const rows = await db<{ player_key: string }[]>`
    select player_key from suppressed_players where org = ${org}`;
  return new Set(rows.map((r) => r.player_key));
}

/** 대회 포스트. 이미 올린 대회면 조용히 건너뛴다. */
export async function insertTournamentPost(
  db: Sql,
  authorId: string,
  body: string,
  payload: TournamentPayload,
): Promise<"inserted" | "duplicate"> {
  try {
    await db`
      insert into posts (author_id, type, body, payload)
      values (${authorId}, 'tournament', ${body}, ${db.json(payload)})`;
    return "inserted";
  } catch (err) {
    // posts_tournament_once_idx 위반. 이미 올린 대회다.
    if ((err as { code?: string }).code === "23505") return "duplicate";
    throw err;
  }
}
