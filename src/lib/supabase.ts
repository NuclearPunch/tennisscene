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
