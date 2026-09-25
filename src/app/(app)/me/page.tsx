"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Avatar } from "@/components/post/Avatar";
import { AccountSettings } from "@/components/AccountSettings";
import { AuthGate } from "@/components/AuthGate";
import { checkAdmin } from "@/lib/adminFetch";
import { useMe } from "@/lib/me";
import { browserClient } from "@/lib/supabase-browser";

/**
 * 지금은 "내가 누구로 로그인했는지"와 로그아웃만 있다. 들어오는 문을 만들었으면
 * 나가는 문도 있어야 한다. 내가 쓴 글 목록은 F-4.3 에서 붙인다.
 *
 * **로그인은 여기서 한다.** 예전엔 글쓰기 화면으로 보냈는데, 로그인하러 온 사람이
 * 로그인하자마자 빈 글쓰기 창을 보게 됐다. 로그인하고 나면 이 자리에 프로필이 뜬다.
 */
export default function MePage() {
  const { me, refresh } = useMe();
  // 관리자에게만 문을 보인다. 권한은 관리자 화면과 API 가 다시 본다.
  // true/false 가 아니라 "관리자로 확인된 계정" 을 기억한다 — 로그아웃하고 다른 계정으로
  // 들어왔을 때 앞 사람의 관리자 문이 잠깐이라도 남지 않게.
  const accountId = me.status === "ready" ? me.account.id : null;
  const [adminOf, setAdminOf] = useState<string | null>(null);
  useEffect(() => {
    if (!accountId) return;
    let alive = true;
    void checkAdmin().then((ok) => alive && setAdminOf(ok ? accountId : null));
    return () => {
      alive = false;
    };
  }, [accountId]);

  if (me.status === "loading") return null;

  if (me.status !== "ready") {
    return (
      <div className="flex min-h-[70dvh] flex-col">
        <AuthGate me={me} refresh={refresh} purpose="account">
          {null}
        </AuthGate>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-3 px-3 py-4">
        <Avatar author={me.account} size={56} />
        <div className="min-w-0 grow">
          <p className="truncate text-[20px] leading-[26px] font-bold tracking-[-0.01em]">
            {me.account.name}
          </p>
          <p className="truncate text-ink-3">@{me.account.handle}</p>
        </div>
        <button
          type="button"
          onClick={() => void browserClient().auth.signOut()}
          className="hair h-[34px] shrink-0 cursor-pointer rounded-full px-4 font-semibold"
        >
          로그아웃
        </button>
      </div>
      {adminOf === me.account.id && (
        <Link
          href="/admin"
          className="hair-t flex h-12 items-center justify-between px-3 font-semibold"
        >
          관리자
          <span aria-hidden className="text-ink-3">
            ›
          </span>
        </Link>
      )}
      <AccountSettings />
    </div>
  );
}
