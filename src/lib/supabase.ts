import { createClient } from "@supabase/supabase-js";

/**
 * 앱에서 쓰는 클라이언트. 공개 키 + RLS 다.
 * 비회원도 피드를 읽어야 하므로 로그인 없이 동작한다.
 *
 * 수집·게시 잡은 이걸 쓰지 않는다 — `src/lib/db.ts` 의 직접 연결을 쓴다.
 */
export function publicClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL 과 NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY 가 필요하다",
    );
  }
  return createClient(url, key, {
    auth: { persistSession: false },
  });
}

/**
 * 로그인한 유저의 토큰으로 도는 서버용 클라이언트. 라우트 핸들러가 요청마다 하나씩 만든다.
 *
 * service_role 을 쓰지 않는다. 유저의 JWT 를 그대로 실어 보내면 **RLS 가 그 사람으로 돈다** —
 * 남의 이름으로 쓰기, 봇 타입으로 쓰기, 카운터 조작을 DB 가 막는다. API 코드가 실수해도
 * 뚫리지 않는다.
 */
export function userClient(accessToken: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL 과 NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY 가 필요하다",
    );
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}
