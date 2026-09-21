"use client";

import Link from "next/link";
import { Avatar } from "@/components/post/Avatar";
import { Placeholder } from "@/components/Placeholder";
import { useMe } from "@/lib/me";
import { browserClient } from "@/lib/supabase-browser";

/**
 * 지금은 "내가 누구로 로그인했는지"와 로그아웃만 있다. 들어오는 문을 만들었으면
 * 나가는 문도 있어야 한다. 내가 쓴 글 목록은 F-4.3 에서 붙인다.
 */
export default function MePage() {
  const { me } = useMe();

  if (me.status === "loading") return null;

  if (me.status !== "ready") {
    return (
      <div className="flex flex-col items-center">
        <Placeholder title="프로필" note="로그인하면 내 이름으로 글을 올릴 수 있습니다." />
        <Link
          href="/compose"
          className="-mt-16 flex h-[34px] items-center rounded-full bg-ink px-4 font-semibold text-bg"
        >
          로그인
        </Link>
      </div>
    );
  }

  return (
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
  );
}
