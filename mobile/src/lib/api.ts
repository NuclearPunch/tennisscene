import { API_URL } from "./config";
import { supabase } from "./supabase";
import type { FeedPage, Post } from "./types";

/**
 * 웹과 같은 서버 API 를 부른다. 인증은 쿠키가 아니라 토큰이다 —
 * 로그인한 사람의 토큰을 Authorization 에 실으면 서버가 RLS 를 그 사람으로 돌린다.
 */

async function token(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function call<T>(path: string, init: RequestInit = {}, auth = false): Promise<T> {
  const headers: Record<string, string> = { ...(init.headers as Record<string, string>) };
  if (init.body) headers["Content-Type"] = "application/json";
  if (auth) {
    const t = await token();
    if (!t) throw new ApiError("로그인이 필요합니다", 401);
    headers.Authorization = `Bearer ${t}`;
  }
  const res = await fetch(`${API_URL}${path}`, { ...init, headers });
  const json = (await res.json().catch(() => ({}))) as T & { error?: string };
  // 서버가 준 문장을 그대로 보여준다. 오류 문구를 두 군데서 짓지 않는다.
  if (!res.ok) throw new ApiError(json.error ?? `요청이 실패했습니다 (${res.status})`, res.status);
  return json;
}

export const api = {
  feed(cursor?: string | null, tag?: string | null) {
    const q = new URLSearchParams();
    if (cursor) q.set("cursor", cursor);
    if (tag) q.set("tag", tag);
    return call<FeedPage>(`/api/feed?${q}`);
  },
  search(q: string) {
    return call<{ posts: Post[]; also: string[]; min: number }>(`/api/search?q=${encodeURIComponent(q)}`);
  },
  thread(id: string) {
    return call<{ post: Post; comments: Post[] }>(`/api/posts/${id}`);
  },
  write(body: string, isAnonymous: boolean) {
    return call<{ id: string }>(`/api/posts`, { method: "POST", body: JSON.stringify({ body, isAnonymous }) }, true);
  },
  comment(id: string, body: string, isAnonymous = false) {
    return call<{ id: string }>(
      `/api/posts/${id}/comments`,
      { method: "POST", body: JSON.stringify({ body, isAnonymous }) },
      true,
    );
  },
  react(kind: "like" | "repost", id: string, on: boolean) {
    return call(`/api/posts/${id}/${kind}`, { method: on ? "PUT" : "DELETE" }, true);
  },
  async reactions(ids: string[]) {
    if (!(await token())) return { liked: [] as string[], reposted: [] as string[] };
    return call<{ liked: string[]; reposted: string[] }>(`/api/reactions?ids=${ids.join(",")}`, {}, true);
  },
};

/** 웹에서 여는 주소. 공유하기·관리자 화면에 쓴다. */
export const webUrl = (path: string) => `${API_URL}${path}`;
