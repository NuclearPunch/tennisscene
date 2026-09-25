import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useMe } from "./me";
import { supabase } from "./supabase";
import type { Post } from "./types";

/**
 * 신고·차단 — 웹(src/lib/moderationClient.tsx)과 같은 규칙이다.
 *
 * 차단은 내 화면에서 가리는 것이다. 신고한 글도 바로 가린다.
 * 익명 글은 신고만 된다 — 차단을 허용하면 작성자를 알아내는 통로가 된다.
 * 확인 창을 닫을 때 가린다(hideLater). 먼저 가리면 글 안에서 띄운 창까지 같이 사라진다.
 */
export const REPORT_REASONS = ["스팸·광고", "욕설·비하", "음란·선정적인 내용", "개인정보 노출", "거짓 정보", "기타"] as const;

/** 피드 뷰는 익명 글과 탈퇴 계정의 아이디를 비워 주고, 서버는 그걸 "anonymous" 로 넘긴다. */
export const isAnonymousAuthor = (post: Post) => post.author.handle === "anonymous";

type Blocked = { handle: string; name: string };
type Ctx = {
  hidden: (post: Post) => boolean;
  blocked: Blocked[];
  report: (postId: string, reason: string) => Promise<"ok" | "again">;
  block: (handle: string) => Promise<void>;
  hideLater: (what: { postId?: string; blocks?: boolean }) => Promise<void>;
  unblock: (handle: string) => Promise<void>;
  myHandle: string | null;
};

const ModCtx = createContext<Ctx | null>(null);

export function ModerationProvider({ children }: { children: React.ReactNode }) {
  const { me } = useMe();
  const myHandle = me.status === "ready" ? me.account.handle : null;
  const [blocked, setBlocked] = useState<Blocked[]>([]);
  const [reported, setReported] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!myHandle) return;
    let alive = true;
    void supabase.rpc("my_blocks").then(({ data }) => alive && setBlocked((data ?? []) as Blocked[]));
    return () => {
      alive = false;
    };
  }, [myHandle]);

  const hidden = useCallback(
    (post: Post) =>
      reported.has(post.id) || (!isAnonymousAuthor(post) && myHandle !== null && blocked.some((b) => b.handle === post.author.handle)),
    [reported, blocked, myHandle],
  );

  const report = useCallback(async (postId: string, reason: string) => {
    const { data, error } = await supabase.rpc("report_post", { target: postId, why: reason, more: null });
    if (error) throw new Error(error.code === "42501" ? "로그인이 필요합니다" : "신고하지 못했습니다. 잠시 뒤 다시 시도해주세요");
    return data === false ? "again" : "ok";
  }, []);

  const block = useCallback(async (handle: string) => {
    const { error } = await supabase.rpc("block_handle", { h: handle });
    if (error) throw new Error(error.message || "차단하지 못했습니다");
  }, []);

  const hideLater = useCallback(async ({ postId, blocks }: { postId?: string; blocks?: boolean }) => {
    if (postId) setReported((prev) => new Set(prev).add(postId));
    if (blocks) {
      const { data } = await supabase.rpc("my_blocks");
      setBlocked((data ?? []) as Blocked[]);
    }
  }, []);

  const unblock = useCallback(async (handle: string) => {
    const { error } = await supabase.rpc("unblock_handle", { h: handle });
    if (error) throw new Error("차단을 풀지 못했습니다");
    setBlocked((prev) => prev.filter((b) => b.handle !== handle));
  }, []);

  return (
    <ModCtx.Provider value={{ hidden, blocked: myHandle ? blocked : [], report, block, hideLater, unblock, myHandle }}>
      {children}
    </ModCtx.Provider>
  );
}

export function useModeration(): Ctx {
  const v = useContext(ModCtx);
  if (!v) throw new Error("ModerationProvider 밖에서 useModeration 을 불렀다");
  return v;
}
