"use client";

import Link from "next/link";
import { AuthGate } from "@/components/AuthGate";
import { Composer } from "@/components/Composer";
import { useMe } from "@/lib/me";

/**
 * 탭바 없는 전체 화면. 쓰는 동안 다른 데로 새지 않게 한다.
 * 로그인하지 않았으면 같은 자리에서 문(AuthGate)이 먼저 나온다 — 읽기에는 로그인이 없다.
 */
export default function ComposePage() {
  const { me, refresh } = useMe();

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[520px] flex-col border-hairline sm:border-x">
      {me.status === "ready" ? (
        <Composer account={me.account} />
      ) : (
        <>
          <header className="flex h-(--header-h) shrink-0 items-center px-3 pt-[env(safe-area-inset-top,0px)]">
            <Link href="/" className="w-14">
              취소
            </Link>
          </header>
          <AuthGate me={me} refresh={refresh}>
            {null}
          </AuthGate>
        </>
      )}
    </div>
  );
}
