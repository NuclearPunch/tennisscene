import { NextResponse } from "next/server";
import { CONTACT_EMAIL } from "@/lib/legal";
import { userClient } from "@/lib/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * 라우트 핸들러 공통 — 토큰을 꺼내고 계정을 확인한다.
 *
 * **여기서 하는 검사는 친절한 오류 메시지를 위한 것이다.** 진짜 방어는 DB 가 한다:
 * 유저의 JWT 를 그대로 PostgREST 에 실어 보내므로 RLS 가 그 사람으로 돈다.
 * 남의 이름으로 좋아요, 카운터 조작, 대댓글은 API 코드가 실수해도 DB 가 막는다.
 */
export const fail = (status: number, error: string) =>
  NextResponse.json({ error }, { status });

export type Caller = { db: SupabaseClient; accountId: string };

export async function requireAccount(
  request: Request,
): Promise<Caller | NextResponse> {
  const token = request.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
  if (!token) return fail(401, "로그인이 필요합니다");

  const db = userClient(token);
  const me = await db.rpc("current_account_id");
  // 만료됐거나 위조된 토큰은 PostgREST 가 여기서 거른다.
  if (me.error) return fail(401, "로그인이 만료됐습니다. 다시 로그인해주세요");
  if (!me.data) return fail(403, "프로필을 먼저 만들어주세요");

  return { db, accountId: me.data as string };
}

export function isCaller(v: Caller | NextResponse): v is Caller {
  return "accountId" in v;
}

/**
 * 관리자만. 여기 검사는 403 을 일찍 주려는 것이고, **진짜 방어는 DB 가 한다** —
 * 채널·기록 테이블의 RLS 와 admin_* 함수가 is_admin() 을 다시 본다.
 *
 * 예외는 "지금 돌리기" 하나다. 잡은 직접 연결로 도니까 DB 가 사람을 모른다.
 * 그 라우트는 이 검사만 믿으므로 반드시 이걸 거친다.
 */
export async function requireAdmin(request: Request): Promise<Caller | NextResponse> {
  const caller = await requireAccount(request);
  if (!isCaller(caller)) return caller;
  const { data, error } = await caller.db.rpc("is_admin");
  if (error) return fail(500, "권한을 확인하지 못했습니다");
  if (data !== true) return fail(403, "관리자만 할 수 있습니다");
  return caller;
}

/**
 * 이용이 정지된 회원이면 403 을 준다. 글·댓글 쓰기 전에 부른다.
 * 막는 건 DB 정책(posts_insert_own)이 한다 — 이건 이유를 알려주려는 것이다.
 * RLS 거부 코드만 보고 "정지" 라고 짐작하면, 다른 이유로 막혔을 때 틀린 말을 하게 된다.
 */
export async function failIfSuspended(db: SupabaseClient): Promise<NextResponse | null> {
  const { data } = await db.rpc("is_suspended");
  return data === true ? fail(403, `이용이 정지된 계정입니다. 문의: ${CONTACT_EMAIL}`) : null;
}
