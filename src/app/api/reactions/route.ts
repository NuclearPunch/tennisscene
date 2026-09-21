import { NextResponse } from "next/server";
import { fail, isCaller, requireAccount } from "@/lib/api";

export const dynamic = "force-dynamic";

/** 한 번에 물어볼 수 있는 글 수. 피드 한 장이 20개라 넉넉하다. */
const MAX_IDS = 100;

/**
 * "이 글들 중에 내가 반응한 게 뭐냐"
 *
 * 피드는 **비회원도 읽으라고** 서버에서 익명 키로 그린다. 그래서 피드 자체는
 * 누가 보는지 모른다. 내 하트가 채워져 있어야 하는지는 화면이 뜬 뒤에 따로 묻는다.
 * 이 한 번의 왕복이 "피드는 누구나 읽는다"를 지키는 값이다.
 */
export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get("ids") ?? "";
  const ids = raw.split(",").map((s) => s.trim()).filter(Boolean).slice(0, MAX_IDS);
  if (ids.length === 0) return NextResponse.json({ liked: [], reposted: [] });

  const caller = await requireAccount(request);
  // 비회원은 반응이 없는 게 정상이다. 오류가 아니다.
  if (!isCaller(caller)) return NextResponse.json({ liked: [], reposted: [] });

  const [likes, reposts] = await Promise.all([
    caller.db.from("likes").select("post_id").eq("account_id", caller.accountId).in("post_id", ids),
    caller.db.from("reposts").select("post_id").eq("account_id", caller.accountId).in("post_id", ids),
  ]);

  if (likes.error || reposts.error) {
    console.error("반응 조회 실패", likes.error ?? reposts.error);
    return fail(500, "반응을 불러오지 못했습니다");
  }

  return NextResponse.json({
    liked: (likes.data ?? []).map((r) => r.post_id),
    reposted: (reposts.data ?? []).map((r) => r.post_id),
  });
}
