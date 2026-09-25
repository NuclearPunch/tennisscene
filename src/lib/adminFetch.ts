"use client";

import { browserClient } from "./supabase-browser";

/**
 * 관리자 API 호출. 로그인 토큰을 실어 보내고, 실패하면 서버가 준 문장을 그대로 던진다.
 * 화면은 그 문장을 보여주기만 한다 — 오류 문구를 두 군데서 짓지 않는다.
 */
export async function adminFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { data } = await browserClient().auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("로그인이 필요합니다");

  const res = await fetch(path, {
    ...init,
    headers: {
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      Authorization: `Bearer ${token}`,
      ...init.headers,
    },
  });
  const json = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(json.error ?? `요청이 실패했습니다 (${res.status})`);
  return json;
}

/** 관리자인가. 메뉴에 "관리자" 를 보여줄지 정할 때만 쓴다 — 권한은 서버가 다시 본다. */
export async function checkAdmin(): Promise<boolean> {
  const { data, error } = await browserClient().rpc("is_admin");
  return !error && data === true;
}
