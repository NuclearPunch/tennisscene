"use client";

import {
  CalendarBlank,
  CaretDown as PhCaretDown,
  CaretUp as PhCaretUp,
  ChartBar,
  ChatCircle,
  CloudRain,
  EyeSlash,
  Heart as PhHeart,
  House,
  Lightbulb,
  MagnifyingGlass,
  Package,
  PaperPlaneTilt,
  Play as PhPlay,
  Plus,
  ArrowUpRight as PhArrowUpRight,
  Repeat,
  TennisBall,
  User,
  X as PhX,
} from "@phosphor-icons/react";
import type { AvatarIcon } from "@/lib/types";

/**
 * UI 아이콘은 직접 그리지 않는다. 획 굵기와 광학 크기가 미세하게 어긋나면
 * 아마추어처럼 보인다. 손으로 그리는 건 인증 배지 하나뿐이다.
 */

type Sized = { className?: string; size?: number };

/* 로고는 src/components/Logo.tsx 에 있다 — 글꼴에서 윤곽선을 딴 생성물이다. */

/**
 * 자동 게시 계정 배지 — 브랜드 요소라 직접 그린다.
 * 옅은 원에 색 체크를 얹으면 "장식"으로 읽힌다. 꽉 채운 원에 흰 체크여야 "인증"으로 읽힌다.
 */
export function Verified({ size = 14 }: Sized) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 14 14"
      className="shrink-0"
      aria-label="자동 게시 계정"
    >
      <circle cx="7" cy="7" r="7" fill="var(--color-green)" />
      <path
        d="M4.1 7.2 6.1 9.1l3.8-4.1"
        fill="none"
        stroke="var(--bg)"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* ── 포스트 액션 ─────────────────────────────────── */

export const Reply = ({ className }: Sized) => (
  <ChatCircle className={className} weight="regular" />
);

export const Repost = ({ className }: Sized) => (
  <Repeat className={className} weight="regular" />
);

export const Heart = ({ filled, className }: Sized & { filled?: boolean }) => (
  <PhHeart className={className} weight={filled ? "fill" : "regular"} />
);

export const Share = ({ className }: Sized) => (
  <PaperPlaneTilt className={className} weight="regular" />
);

/* ── 순위 변동 ───────────────────────────────────── */

export const CaretUp = ({ size = 11 }: Sized) => (
  <PhCaretUp size={size} weight="fill" color="var(--color-green-hi)" />
);

export const CaretDown = ({ size = 11 }: Sized) => (
  <PhCaretDown size={size} weight="fill" color="var(--color-down)" />
);

/** 접고 펴는 줄. 순위 변동 캐럿과 달리 색이 없다 — 글자색을 따라간다. */
export const Chevron = ({ up, className }: Sized & { up?: boolean }) =>
  up ? (
    <PhCaretUp className={className} weight="bold" />
  ) : (
    <PhCaretDown className={className} weight="bold" />
  );

/* ── 첨부 ────────────────────────────────────────── */

/** 외부 링크 표시. 새 탭으로 나간다는 신호다. */
export const ArrowUpRight = ({ className }: Sized) => (
  <PhArrowUpRight className={className} weight="bold" />
);

export const Box = ({ className }: Sized) => (
  <Package className={className} weight="regular" />
);

export const Play = ({ className }: Sized) => (
  <PhPlay className={className} weight="fill" />
);

/** 익명으로 올리기. 가면이나 탐정 아이콘은 장난스럽다 — "안 보인다"는 뜻만 담는다. */
export const Incognito = ({ className }: Sized) => (
  <EyeSlash className={className} weight="regular" />
);

/** 걸린 해시태그를 푼다. 칩 안에 들어가서 아주 작다. */
export const Close = ({ className }: Sized) => (
  <PhX className={className} weight="bold" />
);

/* ── 탭바 — 활성은 fill, 비활성은 regular ─────────── */

type Tab = Sized & { active?: boolean };
const w = (active?: boolean): "fill" | "regular" => (active ? "fill" : "regular");

export const TabHome = ({ active, className }: Tab) => (
  <House className={className} weight={w(active)} />
);
export const TabSearch = ({ active, className }: Tab) => (
  <MagnifyingGlass className={className} weight={active ? "bold" : "regular"} />
);
export const TabCompose = ({ className }: Sized) => (
  <Plus className={className} weight="regular" />
);
export const TabActivity = ({ active, className }: Tab) => (
  <PhHeart className={className} weight={w(active)} />
);
export const TabProfile = ({ active, className }: Tab) => (
  <User className={className} weight={w(active)} />
);

/* ── 계정 아바타 ─────────────────────────────────── */

const AVATAR_ICONS = {
  weather: CloudRain,
  chart: ChartBar,
  play: PhPlay,
  calendar: CalendarBlank,
  box: Package,
  ball: TennisBall,
  tip: Lightbulb,
  chat: ChatCircle,
} as const;

export function AvatarGlyph({
  name,
  className,
}: {
  name: AvatarIcon;
  className?: string;
}) {
  const C = AVATAR_ICONS[name];
  // 꽉 찬 원 위에 얹으므로 fill 이다. 선 아이콘은 작은 크기에서 뭉개진다.
  return <C className={className} weight="fill" />;
}
