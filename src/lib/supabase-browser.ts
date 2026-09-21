"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

/**
 * 브라우저용 클라이언트. 세션을 기억한다(localStorage) — `publicClient` 와 다른 점이다.
 * 하나만 만든다. 여러 개면 토큰 갱신이 서로 밟는다.
 */
export function browserClient(): SupabaseClient {
  client ??= createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } },
  );
  return client;
}
