import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * 수집 잡 전용 클라이언트.
 *
 * service_role 키는 RLS 를 우회한다. **서버에서만 쓴다.**
 * 브라우저 번들에 들어가면 누구나 모든 테이블을 쓸 수 있게 된다.
 */
export function serviceClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "SUPABASE_URL 과 SUPABASE_SERVICE_ROLE_KEY 가 필요하다. " +
        ".env.local 에 넣거나 --dry-run 으로 실행해라.",
    );
  }
  if (typeof window !== "undefined") {
    throw new Error("service_role 클라이언트를 브라우저에서 만들 수 없다");
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
