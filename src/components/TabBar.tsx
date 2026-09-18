"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  TabActivity,
  TabCompose,
  TabHome,
  TabProfile,
  TabSearch,
} from "@/components/icons";

const TABS = [
  { href: "/", label: "홈", Icon: TabHome },
  { href: "/search", label: "검색", Icon: TabSearch },
] as const;

const TABS_RIGHT = [
  { href: "/activity", label: "활동", Icon: TabActivity, dot: true },
  { href: "/me", label: "프로필", Icon: TabProfile, dot: false },
] as const;

/** 쓰레드 방식 — 라벨 없이 아이콘만, 활성은 채운 아이콘, 작성만 배경 */
export function TabBar() {
  const path = usePathname();

  const Item = ({
    href,
    label,
    Icon,
    dot,
  }: {
    href: string;
    label: string;
    Icon: (p: { active?: boolean; className?: string }) => React.ReactElement;
    dot?: boolean;
  }) => {
    const active = href === "/" ? path === "/" : path.startsWith(href);
    return (
      <Link
        href={href}
        aria-label={label}
        aria-current={active ? "page" : undefined}
        className={`relative flex h-10 w-14 items-center justify-center ${
          active ? "text-ink" : "text-muted"
        }`}
      >
        <Icon active={active} className="h-[26px] w-[26px]" />
        {dot && (
          <span className="absolute right-[13px] top-[5px] h-2 w-2 rounded-full border-[1.5px] border-bg bg-green" />
        )}
      </Link>
    );
  };

  return (
    <nav
      aria-label="주요 메뉴"
      className="sticky bottom-0 z-10 flex h-[66px] items-start justify-around border-t border-hairline bg-bg/95 px-2.5 pt-2.5 pb-4 backdrop-blur"
    >
      {TABS.map((t) => (
        <Item key={t.href} {...t} />
      ))}

      <Link
        href="/compose"
        aria-label="글쓰기"
        className="flex h-10 w-14 items-center justify-center"
      >
        <span className="flex h-[35px] w-[46px] items-center justify-center rounded-[11px] bg-grouped text-[#4a5a52]">
          <TabCompose className="h-[21px] w-[21px]" />
        </span>
      </Link>

      {TABS_RIGHT.map((t) => (
        <Item key={t.href} {...t} />
      ))}
    </nav>
  );
}
