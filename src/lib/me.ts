"use client";

import { useCallback, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { browserClient } from "./supabase-browser";
import type { Author, AvatarTone } from "./types";

/**
 * 지금 이 브라우저를 쓰는 사람.
 *
 * 로그인과 계정은 별개다. auth.users 에 행이 생겨도 accounts 에 프로필 한 줄이 없으면
 * 글을 못 쓴다(current_account_id() 가 null). 그 사이 상태가 `needs-profile` 이다.
 */
export type Me =
  | { status: "loading" }
  | { status: "guest" }
  | { status: "needs-profile"; session: Session }
  | { status: "ready"; session: Session; account: Author };

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

  const me = await db.rpc("current_account_id");
  if (me.error || !me.data) return { status: "needs-profile", session };

  // accounts 는 컬럼 단위 권한이다. `*` 로 읽으면 42501 이 난다.
  const { data } = await db
    .from("accounts")
    .select("id, handle, name, initial, tone")
    .eq("id", me.data)
    .single<AccountColumns>();
  if (!data) return { status: "needs-profile", session };

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

export function useMe(): { me: Me; refresh: () => Promise<void> } {
  const [me, setMe] = useState<Me>({ status: "loading" });

  const refresh = useCallback(async () => {
    const { data } = await browserClient().auth.getSession();
    setMe(await resolve(data.session));
  }, []);

  useEffect(() => {
    const auth = browserClient().auth;
    // 첫 호출이 INITIAL_SESSION 을 준다. 따로 getSession 을 부를 필요가 없다.
    const { data } = auth.onAuthStateChange((_event, session) => {
      // 이 콜백 안에서 supabase 를 바로 await 하면 교착된다(라이브러리 문서의 경고).
      // 한 틱 미룬다.
      setTimeout(() => void resolve(session).then(setMe), 0);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  return { me, refresh };
}
