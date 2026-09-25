import type { Session } from "@supabase/supabase-js";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { supabase } from "./supabase";
import type { Author, AvatarTone } from "./types";

/**
 * 지금 이 기기를 쓰는 사람. 웹의 useMe(src/lib/me.ts)와 같은 규칙이다.
 *
 * **`needs-profile` 은 DB 가 "계정 없음" 이라고 답했을 때만이다.** 물어보다 실패한 것을
 * 계정 없음으로 읽으면 이미 계정이 있는 사람에게 닉네임 화면이 뜬다 — 웹에서 실제로 그랬다.
 * 실패는 두 번 더 묻고, 그래도 안 되면 `error` 다.
 *
 * 화면마다 따로 구독하지 않고 앱 전체가 하나를 본다(Provider).
 */
export type Me =
  | { status: "loading" }
  | { status: "guest" }
  | { status: "needs-profile"; session: Session }
  | { status: "error"; session: Session }
  | { status: "ready"; session: Session; account: Author };

const RETRY_MS = [400, 1200];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Row = { id: string; handle: string; name: string; initial: string | null; tone: AvatarTone };

async function resolve(session: Session | null): Promise<Me> {
  if (!session) return { status: "guest" };
  for (let attempt = 0; ; attempt++) {
    const me = await supabase.rpc("current_account_id");
    if (!me.error && !me.data) return { status: "needs-profile", session };
    if (!me.error) {
      // accounts 는 컬럼 단위 권한이다. `*` 로 읽으면 42501 이 난다.
      const { data, error } = await supabase
        .from("accounts")
        .select("id, handle, name, initial, tone")
        .eq("id", me.data)
        .maybeSingle<Row>();
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
    if (attempt >= RETRY_MS.length) return { status: "error", session };
    await sleep(RETRY_MS[attempt]);
  }
}

type Ctx = { me: Me; refresh: () => Promise<void> };
const MeCtx = createContext<Ctx | null>(null);

export function MeProvider({ children }: { children: React.ReactNode }) {
  const [me, setMe] = useState<Me>({ status: "loading" });
  // 마지막으로 시작한 확인만 반영한다. 늦게 끝난 옛 답이 새 답을 덮으면 안 된다.
  const seq = useRef(0);

  const apply = useCallback(async (session: Session | null) => {
    const n = ++seq.current;
    const next = await resolve(session);
    if (n === seq.current) setMe(next);
  }, []);

  const refresh = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    await apply(data.session);
  }, [apply]);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      // 콜백 안에서 supabase 를 바로 await 하면 교착된다(라이브러리 문서의 경고). 한 틱 미룬다.
      setTimeout(() => void apply(session), 0);
    });
    return () => data.subscription.unsubscribe();
  }, [apply]);

  return <MeCtx.Provider value={{ me, refresh }}>{children}</MeCtx.Provider>;
}

export function useMe(): Ctx {
  const v = useContext(MeCtx);
  if (!v) throw new Error("MeProvider 밖에서 useMe 를 불렀다");
  return v;
}
