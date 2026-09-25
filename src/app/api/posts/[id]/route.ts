import { NextResponse } from "next/server";
import { loadThread } from "@/lib/feed";

export const dynamic = "force-dynamic";

/** 글 하나와 댓글 — 앱용. 웹 상세 화면(/p/[id])과 같은 함수를 부른다. */
export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  // uuid 가 아니면 DB 까지 가지 않는다. 가면 22P02 로 500 이 난다.
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "없는 글입니다" }, { status: 404 });
  try {
    const thread = await loadThread(id);
    if (!thread) return NextResponse.json({ error: "없는 글입니다" }, { status: 404 });
    return NextResponse.json(thread);
  } catch (err) {
    console.error("글 조회 실패", err);
    return NextResponse.json({ error: "글을 불러오지 못했습니다" }, { status: 500 });
  }
}
