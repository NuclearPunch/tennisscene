"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { useMe } from "./me";
import { browserClient } from "./supabase-browser";
import type { Post } from "./types";

/**
 * 신고·차단을 화면 전체가 같이 본다.
 *
 * **차단은 내 화면에서 가리는 것이다.** 피드는 비회원도 읽으라고 서버가 익명으로 그려서
 * 누가 보는지 모른다. 그래서 차단한 아이디의 글은 화면이 걸러낸다(웹·앱 같은 방식).
 * **신고한 글도 바로 가린다** — 신고해 놓고 계속 봐야 하는 건 이상하다.
 *
 * 익명 글은 신고만 된다. 차단을 허용하면 차단·해제를 반복해 작성자를 알아내는 통로가 된다.
 */
export const REPORT_REASONS = [
  "스팸·광고",
  "욕설·비하",
  "음란·선정적인 내용",
  "개인정보 노출",
  "거짓 정보",
  "기타",
] as const;

/** 피드 뷰는 익명 글과 탈퇴 계정의 아이디를 비워 주고, 화면은 그걸 "anonymous" 로 받는다. */
export const isAnonymousAuthor = (post: Post) =>
  post.author.handle === "anonymous";

type Ctx = {
  hidden: (post: Post) => boolean;
  blocked: { handle: string; name: string }[];
  /** DB 에 신고를 넣는다. 화면에서 가리는 건 hideLater 로 따로 한다. */
  report: (
    postId: string,
    reason: string,
    detail?: string,
  ) => Promise<"ok" | "again">;
  /** DB 에 차단을 넣는다. 화면에서 가리는 건 hideLater 로 따로 한다. */
  block: (handle: string) => Promise<void>;
  /**
   * 신고·차단한 걸 화면에서 가린다. 확인 창을 닫을 때 부른다 —
   * 바로 가리면 글 안에 있는 확인 창까지 같이 사라진다.
   */
  hideLater: (what: { postId?: string; blocks?: boolean }) => Promise<void>;
  unblock: (handle: string) => Promise<void>;
  /** 로그인이 필요한 일인데 안 돼 있으면 로그인 창을 연다. 됐으면 true. */
  signedIn: () => boolean;
  myHandle: string | null;
};

const ModCtx = createContext<Ctx | null>(null);

export function ModerationProvider({
  children,
  needLogin,
}: {
  children: React.ReactNode;
  needLogin: () => void;
}) {
  const { me } = useMe();
  const myHandle = me.status === "ready" ? me.account.handle : null;
  const [blocked, setBlocked] = useState<{ handle: string; name: string }[]>(
    [],
  );
  const [reported, setReported] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!myHandle) return;
    let alive = true;
    void browserClient()
      .rpc("my_blocks")
      .then(
        ({ data }) =>
          alive &&
          setBlocked((data ?? []) as { handle: string; name: string }[]),
      );
    return () => {
      alive = false;
    };
  }, [myHandle]);

  const hidden = useCallback(
    (post: Post) =>
      reported.has(post.id) ||
      (!isAnonymousAuthor(post) &&
        myHandle !== null &&
        blocked.some((b) => b.handle === post.author.handle)),
    [reported, blocked, myHandle],
  );

  const signedIn = useCallback(() => {
    if (myHandle) return true;
    needLogin();
    return false;
  }, [myHandle, needLogin]);

  const report = useCallback(
    async (postId: string, reason: string, detail?: string) => {
      const { data, error } = await browserClient().rpc("report_post", {
        target: postId,
        why: reason,
        more: detail ?? null,
      });
      if (error)
        throw new Error(
          error.code === "42501"
            ? "로그인이 필요합니다"
            : "신고하지 못했습니다. 잠시 뒤 다시 시도해주세요",
        );
      return data === false ? "again" : "ok";
    },
    [],
  );

  const block = useCallback(async (handle: string) => {
    const { error } = await browserClient().rpc("block_handle", { h: handle });
    if (error) throw new Error(error.message || "차단하지 못했습니다");
  }, []);

  const hideLater = useCallback(
    async ({ postId, blocks }: { postId?: string; blocks?: boolean }) => {
      if (postId) setReported((prev) => new Set(prev).add(postId));
      if (blocks) {
        const { data } = await browserClient().rpc("my_blocks");
        setBlocked((data ?? []) as { handle: string; name: string }[]);
      }
    },
    [],
  );

  const unblock = useCallback(async (handle: string) => {
    const { error } = await browserClient().rpc("unblock_handle", {
      h: handle,
    });
    if (error) throw new Error("차단을 풀지 못했습니다");
    setBlocked((prev) => prev.filter((b) => b.handle !== handle));
  }, []);

  return (
    <ModCtx.Provider
      value={{
        hidden,
        blocked: myHandle ? blocked : [],
        report,
        block,
        hideLater,
        unblock,
        signedIn,
        myHandle,
      }}
    >
      {children}
    </ModCtx.Provider>
  );
}

export function useModeration(): Ctx {
  const v = useContext(ModCtx);
  if (!v) throw new Error("ModerationProvider 밖에서 useModeration 을 불렀다");
  return v;
}
