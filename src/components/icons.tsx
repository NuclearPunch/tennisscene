"use client";

import {
  CalendarBlank,
  CaretDown as PhCaretDown,
  CaretUp as PhCaretUp,
  ChartBar,
  ChatCircle,
  CloudRain,
  Heart as PhHeart,
  House,
  MagnifyingGlass,
  Package,
  PencilSimple,
  Play as PhPlay,
  ArrowUpRight as PhArrowUpRight,
  Repeat,
  TennisBall,
  User,
} from "@phosphor-icons/react";
import type { AvatarIcon } from "@/lib/types";

/**
 * UI 아이콘은 직접 그리지 않는다. 획 굵기와 광학 크기가 미세하게 어긋나면
 * 아마추어처럼 보인다. 손으로 그리는 건 로고 마크 하나뿐이다.
 */

type Sized = { className?: string; size?: number };

/* ── 로고 ───────────────────────────────────────── */

export function BallMark({ size = 20, className }: Sized) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className={className} aria-hidden>
      <circle cx="50" cy="50" r="46" fill="var(--color-ball)" />
      <path
        d="M20 14 Q46 50 20 86"
        fill="none"
        stroke="var(--color-green-deep)"
        strokeWidth="6"
        strokeLinecap="round"
      />
      <path
        d="M80 14 Q54 50 80 86"
        fill="none"
        stroke="var(--color-green-deep)"
        strokeWidth="6"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** 랭킹 카드 우상단에 반쯤 걸치는 장식 */
export function BallTexture({ className }: Sized) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden>
      <circle cx="50" cy="50" r="46" fill="var(--color-ball)" />
      <path
        d="M20 14 Q46 50 20 86"
        fill="none"
        stroke="var(--color-green-deep)"
        strokeWidth="3.4"
        strokeLinecap="round"
      />
      <path
        d="M80 14 Q54 50 80 86"
        fill="none"
        stroke="var(--color-green-deep)"
        strokeWidth="3.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** 자동 게시 계정 배지 — 브랜드 요소라 직접 그린다 */
export function Verified({ size = 13 }: Sized) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" aria-label="자동 게시 계정">
      <circle cx="7" cy="7" r="6.2" fill="var(--color-green-bg)" />
      <path
        d="M4.3 7.1 6.1 8.9l3.6-3.8"
        fill="none"
        stroke="var(--color-green)"
        strokeWidth="1.6"
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

/* ── 순위 변동 ───────────────────────────────────── */

export const CaretUp = ({ size = 11 }: Sized) => (
  <PhCaretUp size={size} weight="fill" color="var(--color-green-hi)" />
);

export const CaretDown = ({ size = 11 }: Sized) => (
  <PhCaretDown size={size} weight="fill" color="var(--color-down)" />
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
  <PencilSimple className={className} weight="regular" />
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
} as const;

export function AvatarGlyph({
  name,
  className,
}: {
  name: AvatarIcon;
  className?: string;
}) {
  const C = AVATAR_ICONS[name];
  return <C className={className} weight="regular" />;
}
