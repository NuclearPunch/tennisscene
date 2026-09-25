"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { browserClient } from "./supabase-browser";
import type { Author, AvatarTone } from "./types";

/**
 * 지금 이 브라우저를 쓰는 사람.
 *
 * 로그인과 계정은 별개다. auth.users 에 행이 생겨도 accounts 에 프로필 한 줄이 없으면
 * 글을 못 쓴다(current_account_id() 가 null). 그 사이 상태가 `needs-profile` 이다.
 *
 * **`needs-profile` 은 DB 가 "계정 없음" 이라고 답했을 때만이다.** 물어보다 실패한 것
 * (네트워크, 만료 토큰, 스키마 다시 읽는 중)을 계정 없음으로 읽으면, 이미 계정이 있는
 * 사람에게 닉네임 만들기 화면이 뜬다 — 실제로 그랬다. 실패는 `error` 로 따로 둔다.
 */
export type Me =
  | { status: "loading" }
  | { status: "guest" }
  | { status: "needs-profile"; session: Session }
  | { status: "error"; session: Session }
  | { status: "ready"; session: Session; account: Author };

/** 계정 조회가 실패하면 이만큼 쉬고 다시 묻는다. 대부분 한 번 더 물으면 된다. */
const RETRY_MS = [400, 1200];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type AccountColumns = {
  id: string;
  handle: string;
  name: string;
  initial: string | null;
  tone: AvatarTone;
};

async function resolve(session: Session | null): Promise<Me> {
  if (!session) return { status: "guest" };
  const db = browserClient();

  for (let attempt = 0; ; attempt++) {
    const me = await db.rpc("current_account_id");
    // 물어보는 데 성공했고 답이 "없음" 일 때만 프로필을 만들게 한다.
    if (!me.error && !me.data) return { status: "needs-profile", session };

    if (!me.error) {
      // accounts 는 컬럼 단위 권한이다. `*` 로 읽으면 42501 이 난다.
      const { data, error } = await db
        .from("accounts")
        .select("id, handle, name, initial, tone")
        .eq("id", me.data)
        .maybeSingle<AccountColumns>();
      if (!error && data) {
        return {
          status: "ready",
          session,
          account: {
            id: data.id,
            handle: data.handle,
            name: data.name,
            kind: "user",
            initial: data.initial ?? data.name.slice(0, 1),
            tone: data.tone,
          },
        };
      }
    }

    if (attempt >= RETRY_MS.length) {
      console.warn("[me] 계정을 확인하지 못했다", me.error ?? "accounts 조회 실패");
      return { status: "error", session };
    }
    await sleep(RETRY_MS[attempt]);
  }
}

export function useMe(): { me: Me; refresh: () => Promise<void> } {
  const [me, setMe] = useState<Me>({ status: "loading" });
  /**
   * 마지막으로 시작한 확인만 반영한다. 로그인 직후에는 이벤트가 몇 개 연달아 오고,
   * 재시도 때문에 먼저 시작한 확인이 나중에 끝날 수 있다. 늦게 온 옛 답이 새 답을 덮으면 안 된다.
   */
  const seq = useRef(0);

  const apply = useCallback(async (session: Session | null) => {
    const n = ++seq.current;
    const next = await resolve(session);
    if (n === seq.current) setMe(next);
  }, []);

  const refresh = useCallback(async () => {
    const { data } = await browserClient().auth.getSession();
    await apply(data.session);
  }, [apply]);

  useEffect(() => {
    const auth = browserClient().auth;
    // 첫 호출이 INITIAL_SESSION 을 준다. 따로 getSession 을 부를 필요가 없다.
    const { data } = auth.onAuthStateChange((_event, session) => {
      // 이 콜백 안에서 supabase 를 바로 await 하면 교착된다(라이브러리 문서의 경고).
      // 한 틱 미룬다.
      setTimeout(() => void apply(session), 0);
    });
    return () => data.subscription.unsubscribe();
  }, [apply]);

  return { me, refresh };
}
