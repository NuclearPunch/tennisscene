import { router } from "expo-router";
import { createContext, useCallback, useContext, useRef, useState } from "react";
import { api, ApiError } from "./api";

/**
 * 내가 누른 반응을 앱 전체가 같이 본다 — 피드와 상세 화면에 같은 글이 있을 수 있다.
 *
 * **낙관적으로 먼저 칠한다.** 누르는 순간 하트가 차고 숫자가 오른다. 서버가 거절하면 되돌린다.
 *
 * 숫자는 "처음 받은 상태 대비 지금 상태" 로 계산한다. 서버 숫자(stats)는 글을 받은 순간의 값이라,
 * 누른 뒤 서버가 받아들였다고 변화분을 지워 버리면 숫자가 다시 원래대로 보인다.
 */
export type Kind = "like" | "repost";
const key = (kind: Kind, id: string) => `${kind}:${id}`;

type State = {
  on: (kind: Kind, id: string) => boolean;
  delta: (kind: Kind, id: string) => number;
  toggle: (kind: Kind, id: string) => void;
  hydrate: (ids: string[]) => Promise<void>;
  /** 로그아웃하면 비운다. 다음 사람에게 앞 사람의 하트가 보이면 안 된다. */
  reset: () => void;
};

const Ctx = createContext<State | null>(null);

export function ReactionProvider({ children }: { children: React.ReactNode }) {
  /** 글을 처음 봤을 때 서버가 알려준 "내가 누른 것" */
  const [base, setBase] = useState<Set<string>>(new Set());
  /** 지금 내가 누른 것 */
  const [mine, setMine] = useState<Set<string>>(new Set());
  const asked = useRef<Set<string>>(new Set());

  const on = useCallback((kind: Kind, id: string) => mine.has(key(kind, id)), [mine]);
  const delta = useCallback(
    (kind: Kind, id: string) => Number(mine.has(key(kind, id))) - Number(base.has(key(kind, id))),
    [mine, base],
  );

  const hydrate = useCallback(async (ids: string[]) => {
    const fresh = ids.filter((id) => !asked.current.has(id));
    if (fresh.length === 0) return;
    for (const id of fresh) asked.current.add(id);
    try {
      const r = await api.reactions(fresh);
      const add = (s: Set<string>) => {
        const next = new Set(s);
        for (const id of r.liked) next.add(key("like", id));
        for (const id of r.reposted) next.add(key("repost", id));
        return next;
      };
      setBase(add);
      setMine(add);
    } catch {
      // 못 채우면 빈 채로 둔다. 눌러 보면 서버가 정리해 준다.
    }
  }, []);

  const flip = (k: string) =>
    setMine((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });

  const toggle = useCallback(
    (kind: Kind, id: string) => {
      const k = key(kind, id);
      const turningOn = !mine.has(k);
      flip(k);
      api.react(kind, id, turningOn).catch((e) => {
        flip(k); // 원래대로
        // 로그인이 안 돼 있으면 프로필 탭(로그인)으로 보낸다.
        if (e instanceof ApiError && e.status === 401) router.navigate("/me");
      });
    },
    [mine],
  );

  const reset = useCallback(() => {
    asked.current = new Set();
    setBase(new Set());
    setMine(new Set());
  }, []);

  return <Ctx.Provider value={{ on, delta, toggle, hydrate, reset }}>{children}</Ctx.Provider>;
}

export function useReactions(): State {
  const v = useContext(Ctx);
  if (!v) throw new Error("ReactionProvider 밖에서 useReactions 를 불렀다");
  return v;
}
