"use client";

import Link from "next/link";
import { Avatar } from "@/components/post/Avatar";
import { TabProfile } from "@/components/icons";
import { useMe } from "@/lib/me";

/**
 * 피드 맨 위의 작성 유도 줄. 쓰레드의 "새로운 소식이 있나요?" 자리다.
 * 봇 글만 흐르는 피드에서 "여기 네 글도 올라간다"를 알려주는 유일한 신호다.
 * 로그인했으면 쓰레드처럼 내 얼굴과 이름이 먼저 나온다.
 */
export function ComposePrompt() {
  const { me } = useMe();
  const account = me.status === "ready" ? me.account : null;

  return (
    <Link href="/compose" className="hair-b flex items-center gap-2.5 px-3 pt-1 pb-3">
      {account ? (
        <Avatar author={account} />
      ) : (
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-grouped text-ink-3">
          <TabProfile active className="h-5 w-5" />
        </span>
      )}
      <span className="min-w-0">
        {account && <span className="block truncate font-semibold">{account.name}</span>}
        <span className="block text-ink-3">오늘 코트에서 무슨 일이 있었나요?</span>
      </span>
    </Link>
  );
}
