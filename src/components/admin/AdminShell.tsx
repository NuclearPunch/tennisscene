"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { AuthGate } from "@/components/AuthGate";
import { checkAdmin } from "@/lib/adminFetch";
import { useMe } from "@/lib/me";

const NAV = [
  { href: "/admin/channels", label: "유튜브 채널" },
  { href: "/admin/jobs", label: "수집 기록" },
  { href: "/admin/posts", label: "글 관리" },
];

/**
 * 관리자 화면 뼈대. 탭바 없는 전체 화면이다(글쓰기와 같은 자리).
 *
 * 여기서 막는 건 **보여주지 않으려는 것**이다. 진짜 방어는 API 와 DB 가 한다 —
 * 이 컴포넌트를 우회해도 데이터는 한 줄도 안 나온다.
 */
export function AdminShell({ children }: { children: React.ReactNode }) {
  const { me, refresh } = useMe();
  const path = usePathname();
  // 확인이 끝난 계정과 그 결과. 계정이 바뀌면 다시 확인하기 전까지 아무것도 안 보인다.
  const accountId = me.status === "ready" ? me.account.id : null;
  const [checked, setChecked] = useState<{ id: string; admin: boolean } | null>(null);

  useEffect(() => {
    if (!accountId) return;
    let alive = true;
    void checkAdmin().then((admin) => alive && setChecked({ id: accountId, admin }));
    return () => {
      alive = false;
    };
  }, [accountId]);

  const admin = accountId && checked?.id === accountId ? checked.admin : null;

  // undefined: 들어와도 됨 · null: 아직 확인 중 · "login": 그 자리에서 로그인 · 문자열: 막힌 이유
  const gate =
    me.status === "loading"
      ? null
      : me.status !== "ready"
        ? "login"
        : admin === null
          ? null
          : admin === false
            ? "관리자만 볼 수 있습니다"
            : undefined;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[640px] flex-col border-hairline sm:border-x">
      <header className="sticky top-0 z-20 bg-bg/85 pt-[env(safe-area-inset-top,0px)] backdrop-blur-xl">
        <div className="flex h-(--header-h) items-center px-3">
          <Link href="/me" className="w-14">
            닫기
          </Link>
          <h1 className="grow text-center font-bold">관리자</h1>
          <span className="w-14" />
        </div>
        {gate === undefined && (
          <nav className="hair-b no-scrollbar flex gap-1.5 overflow-x-auto px-3 pb-2.5">
            {NAV.map((n) => {
              const on = path.startsWith(n.href);
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  aria-current={on ? "page" : undefined}
                  className={`flex h-[34px] shrink-0 items-center rounded-full px-3.5 font-semibold ${
                    on ? "bg-ink text-bg" : "hair text-ink"
                  }`}
                >
                  {n.label}
                </Link>
              );
            })}
          </nav>
        )}
      </header>

      {gate === undefined ? (
        <main className="grow">{children}</main>
      ) : gate === null ? null : gate === "login" ? (
        <AuthGate me={me} refresh={refresh} purpose="account">
          {null}
        </AuthGate>
      ) : (
        <p className="px-8 py-20 text-center text-ink-3">{gate}</p>
      )}
    </div>
  );
}
