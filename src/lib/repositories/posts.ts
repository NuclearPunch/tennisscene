import type { SupabaseClient } from "@supabase/supabase-js";
import type { RankingPayload } from "@/lib/types";

/** 랭킹 포스트를 쓴다. 이미 같은 단체·부서·주차가 있으면 조용히 건너뛴다. */
export async function insertRankingPost(
  db: SupabaseClient,
  authorId: string,
  body: string,
  payload: RankingPayload,
): Promise<"inserted" | "duplicate"> {
  const { error } = await db.from("posts").insert({
    author_id: authorId,
    type: "ranking",
    body,
    payload,
  });

  if (!error) return "inserted";

  // posts_ranking_once_idx 위반. 게시 잡을 두 번 돌린 것뿐이라 실패가 아니다.
  if (error.code === "23505") return "duplicate";
  throw error;
}

/** 이름 비공개가 승인된 선수. 발행 전에 걸러내려고 읽는다. */
export async function loadSuppressedPlayers(
  db: SupabaseClient,
  org: string,
): Promise<Set<string>> {
  const { data, error } = await db
    .from("suppressed_players")
    .select("player_key")
    .eq("org", org);

  if (error) throw error;
  return new Set((data ?? []).map((r) => r.player_key as string));
}
