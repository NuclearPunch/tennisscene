import "expo-sqlite/localStorage/install";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./config";

/**
 * 로그인을 기억하는 클라이언트. 세션은 기기의 localStorage(expo-sqlite)에 남는다 —
 * 앱을 껐다 켜도 로그인이 유지된다. (Expo 공식 Supabase 가이드 그대로)
 *
 * 웹과 같은 공개 키 + RLS 다. 글쓰기·좋아요는 이 세션의 토큰을 서버 API 에 실어 보낸다.
 */
export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    autoRefreshToken: true,
    persistSession: true,
    // 네이티브 앱에는 세션을 읽을 주소창이 없다.
    detectSessionInUrl: false,
  },
});
