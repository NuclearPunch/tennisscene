import { NextResponse } from "next/server";
import { alsoSearched } from "@/lib/divisions";
import { SEARCH_MIN, searchPosts } from "@/lib/feed";

export const dynamic = "force-dynamic";

/**
 * 검색 — 앱용. 웹 검색 화면(/search)과 같은 함수를 부른다.
 * `also` 는 같은 부서라 함께 찾은 다른 이름들이다(오픈부 → 마스터스부·마스터즈부).
 */
export async function GET(request: Request) {
  const q = (new URL(request.url).searchParams.get("q") ?? "").trim();
  if (q.length < SEARCH_MIN) return NextResponse.json({ posts: [], also: [], min: SEARCH_MIN });
  try {
    return NextResponse.json({ posts: await searchPosts(q), also: alsoSearched(q), min: SEARCH_MIN });
  } catch (err) {
    console.error("검색 실패", err);
    return NextResponse.json({ error: "검색하지 못했습니다" }, { status: 500 });
  }
}
