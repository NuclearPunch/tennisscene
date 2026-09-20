import { NextResponse } from "next/server";
import { loadFeed } from "@/lib/feed";

// 수집 잡이 새 포스트를 올리므로 캐시하지 않는다.
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const cursor = new URL(request.url).searchParams.get("cursor") ?? undefined;

  try {
    return NextResponse.json(await loadFeed(cursor));
  } catch (err) {
    console.error("feed 조회 실패", err);
    return NextResponse.json(
      { error: "피드를 불러오지 못했습니다" },
      { status: 500 },
    );
  }
}
