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

type TabIcon = (p: { active?: boolean; className?: string }) => React.ReactElement;

const TABS: { href: string; label: string; Icon: TabIcon }[] = [
  { href: "/", label: "홈", Icon: TabHome },
  { href: "/search", label: "검색", Icon: TabSearch },
  { href: "/compose", label: "글쓰기", Icon: TabCompose },
  { href: "/activity", label: "활동", Icon: TabActivity },
  { href: "/me", label: "프로필", Icon: TabProfile },
];

/**
 * 쓰레드 앱의 떠 있는 탭바. 바닥에 붙은 띠가 아니라 유리 알약이고, 뒤로 피드가 비친다.
 * 지금 있는 탭은 아이콘을 채우고 알약 안에 더 밝은 알약을 깐다.
 * 알림 점은 실제 알림이 생기면 붙인다. 항상 켜져 있는 점은 거짓말이다.
 */
export function TabBar() {
  const path = usePathname();

  return (
    <nav
      aria-label="주요 메뉴"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-20 flex justify-center px-6 pb-[max(env(safe-area-inset-bottom),14px)]"
    >
      <div className="glass hair pointer-events-auto flex w-full max-w-[400px] items-center rounded-full p-1">
        {TABS.map(({ href, label, Icon }) => {
          const active = href === "/" ? path === "/" : path.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              aria-label={label}
              aria-current={active ? "page" : undefined}
              className={`flex h-[52px] grow items-center justify-center rounded-full ${
                active ? "bg-glass-active" : ""
              }`}
            >
              <Icon active={active} className="h-[26px] w-[26px]" />
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
