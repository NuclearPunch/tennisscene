import { NextResponse } from "next/server";
import { validatePostInput } from "@/lib/postInput";
import { userClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const fail = (status: number, error: string) =>
  NextResponse.json({ error }, { status });

/**
 * 글 저장 — B-3.2
 *
 * 여기서 하는 검사는 친절한 오류 메시지를 위한 것이다. **진짜 방어는 DB 가 한다:**
 *   · 남의 계정으로 쓰기      → posts_insert_own (author_id = current_account_id())
 *   · 봇 타입(ranking 등)     → 같은 정책의 type = 'text'
 *   · 좋아요 수 끼워 넣기     → 카운터 컬럼에 insert 권한이 없다
 *   · 500자 초과              → check (char_length(body) <= 500)
 */
export async function POST(request: Request) {
  const token = request.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
  if (!token) return fail(401, "로그인이 필요합니다");

  const checked = validatePostInput(await request.json().catch(() => null));
  if (!checked.ok) return fail(400, checked.reason);

  const db = userClient(token);

  const me = await db.rpc("current_account_id");
  if (me.error) {
    // 만료됐거나 위조된 토큰은 PostgREST 가 여기서 거른다.
    return fail(401, "로그인이 만료됐습니다. 다시 로그인해주세요");
  }
  if (!me.data) return fail(403, "프로필을 먼저 만들어주세요");

  const { data, error } = await db
    .from("posts")
    .insert({
      author_id: me.data,
      type: "text",
      body: checked.value.body,
      is_anonymous: checked.value.isAnonymous,
    })
    // base 테이블은 컬럼 단위 권한이라 `*` 로 돌려받으면 42501 이 난다.
    .select("id, created_at")
    .single();

  if (error) {
    console.error("글 저장 실패", error);
    return fail(500, "글을 올리지 못했습니다. 잠시 뒤 다시 시도해주세요");
  }

  return NextResponse.json({ id: data.id, createdAt: data.created_at }, { status: 201 });
}
