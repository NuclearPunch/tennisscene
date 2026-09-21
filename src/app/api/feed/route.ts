import { NextResponse } from "next/server";
import { loadFeed } from "@/lib/feed";

// 수집 잡이 새 포스트를 올리므로 캐시하지 않는다.
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const cursor = params.get("cursor") ?? undefined;
  // 해시태그 모아보기. 모르는 값은 loadFeed 가 무시하고 전체를 준다.
  const tag = params.get("tag") ?? undefined;

  try {
    return NextResponse.json(await loadFeed(cursor, tag));
  } catch (err) {
    console.error("feed 조회 실패", err);
    return NextResponse.json(
      { error: "피드를 불러오지 못했습니다" },
      { status: 500 },
    );
  }
}
