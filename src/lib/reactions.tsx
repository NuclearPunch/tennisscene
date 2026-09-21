"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { browserClient } from "./supabase-browser";

/**
 * 내가 누른 반응을 화면 전체가 같이 본다.
 *
 * 같은 글이 피드에도 상세 화면에도 있을 수 있다. 각자 상태를 들고 있으면
 * 한쪽에서 누른 하트가 다른 쪽에서 비어 있게 된다.
 *
 * **낙관적으로 먼저 칠한다.** 누르는 순간 하트가 차고 숫자가 오른다.
 * 서버가 거절하면 되돌린다 — 네트워크를 기다리는 동안 멈춰 있으면 앱 같지 않다.
 */

export type Kind = "like" | "repost";

type State = {
  on: (kind: Kind, id: string) => boolean;
  /** 서버 숫자에 내 낙관적 변화를 더한 값 */
  delta: (kind: Kind, id: string) => number;
  toggle: (kind: Kind, id: string) => void;
  /** 피드가 화면에 뜬 뒤 "이 중 내가 반응한 게 뭐냐"를 채운다 */
  hydrate: (ids: string[]) => Promise<void>;
  /** 로그인하지 않은 사람이 반응을 누르면 여기로 신호가 온다 */
  onNeedsLogin: (fn: () => void) => void;
};

const Ctx = createContext<State | null>(null);

const key = (kind: Kind, id: string) => `${kind}:${id}`;

export function ReactionProvider({ children }: { children: React.ReactNode }) {
  /** 서버가 알려준 "내가 누른 것" */
  const [server, setServer] = useState<Set<string>>(new Set());
  /** 내가 방금 눌러서 서버와 달라진 것 */
  const [pending, setPending] = useState<Set<string>>(new Set());
  const asked = useRef<Set<string>>(new Set());
  const needsLogin = useRef<(() => void) | null>(null);

  const on = useCallback(
    (kind: Kind, id: string) => {
      const k = key(kind, id);
      // 서버 상태에 내 변경을 뒤집어서 얹는다.
      return server.has(k) !== pending.has(k);
    },
    [server, pending],
  );

  const delta = useCallback(
    (kind: Kind, id: string) => {
      const k = key(kind, id);
      if (!pending.has(k)) return 0;
      return server.has(k) ? -1 : 1;
    },
    [server, pending],
  );

  const hydrate = useCallback(async (ids: string[]) => {
    const fresh = ids.filter((id) => !asked.current.has(id));
    if (fresh.length === 0) return;
    for (const id of fresh) asked.current.add(id);

    const { data } = await browserClient().auth.getSession();
    const token = data.session?.access_token;
    if (!token) return; // 비회원은 채울 게 없다

    try {
      const res = await fetch(`/api/reactions?ids=${fresh.join(",")}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const body = (await res.json()) as { liked: string[]; reposted: string[] };
      setServer((prev) => {
        const next = new Set(prev);
        for (const id of body.liked) next.add(key("like", id));
        for (const id of body.reposted) next.add(key("repost", id));
        return next;
      });
    } catch {
      // 못 채우면 비어 있는 채로 둔다. 눌러보면 서버가 정리해 준다.
    }
  }, []);

  const toggle = useCallback(
    (kind: Kind, id: string) => {
      const k = key(kind, id);
      const wasOn = server.has(k) !== pending.has(k);

      // 먼저 칠한다.
      setPending((prev) => {
        const next = new Set(prev);
        if (next.has(k)) next.delete(k);
        else next.add(k);
        return next;
      });

      void (async () => {
        const { data } = await browserClient().auth.getSession();
        const token = data.session?.access_token;
        if (!token) {
          // 되돌리고 로그인 시트를 띄운다.
          setPending((prev) => {
            const next = new Set(prev);
            next.delete(k);
            return next;
          });
          needsLogin.current?.();
          return;
        }

        try {
          const res = await fetch(`/api/posts/${id}/${kind}`, {
            method: wasOn ? "DELETE" : "PUT",
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!res.ok) throw new Error(String(res.status));
          // 서버가 받았으니 그 상태를 기준으로 옮기고 낙관적 표시를 지운다.
          setServer((prev) => {
            const next = new Set(prev);
            if (wasOn) next.delete(k);
            else next.add(k);
            return next;
          });
          setPending((prev) => {
            const next = new Set(prev);
            next.delete(k);
            return next;
          });
        } catch {
          // 실패하면 원래대로. 사용자는 하트가 되돌아가는 걸로 안다.
          setPending((prev) => {
            const next = new Set(prev);
            next.delete(k);
            return next;
          });
        }
      })();
    },
    [server, pending],
  );

  const value = useMemo<State>(
    () => ({
      on,
      delta,
      toggle,
      hydrate,
      onNeedsLogin: (fn) => {
        needsLogin.current = fn;
      },
    }),
    [on, delta, toggle, hydrate],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useReactions(): State {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("ReactionProvider 안에서만 쓸 수 있다");
  return ctx;
}
