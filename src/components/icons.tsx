import type { SVGProps } from "react";
import type { AvatarIcon } from "@/lib/types";

type I = SVGProps<SVGSVGElement>;

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

export function BallMark({ size = 20, ...p }: I & { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden {...p}>
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

/** 랭킹 카드 우상단에 반쯤 걸치는 장식용 공 */
export function BallTexture(p: I) {
  return (
    <svg viewBox="0 0 100 100" aria-hidden {...p}>
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

export function Cloud(p: I) {
  return (
    <svg viewBox="0 0 32 32" strokeWidth="1.9" {...stroke} {...p}>
      <path d="M9.5 19.5a4.6 4.6 0 0 1 .5-9.2 6.7 6.7 0 0 1 12.6 1.9 4.2 4.2 0 0 1-.7 7.3" />
      <path d="M12 23.5l-1 2.8M17 23.5l-1 2.8M22 23.5l-1 2.8" />
    </svg>
  );
}

export function Chart(p: I) {
  return (
    <svg viewBox="0 0 24 24" strokeWidth="2.1" {...stroke} {...p}>
      <path d="M4.5 19.5V13M12 19.5V5M19.5 19.5v-8" />
    </svg>
  );
}

export function Play(p: I) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden {...p}>
      <path d="M4.8 2.6 13.4 8l-8.6 5.4z" />
    </svg>
  );
}

export function Calendar(p: I) {
  return (
    <svg viewBox="0 0 24 24" strokeWidth="1.7" {...stroke} {...p}>
      <rect x="3.5" y="5" width="15" height="13.5" rx="3" />
      <path d="M3.5 9.5h15M7.5 3v4M14.5 3v4" />
    </svg>
  );
}

export function Box(p: I) {
  return (
    <svg viewBox="0 0 24 24" strokeWidth="1.7" {...stroke} {...p}>
      <path d="M4 7.6 12 3.6l8 4v8.8l-8 4-8-4z" />
      <path d="M4 7.6 12 11.6l8-4M12 11.6v8.8" />
    </svg>
  );
}

export function BallOutline(p: I) {
  return (
    <svg viewBox="0 0 24 24" strokeWidth="1.8" {...stroke} {...p}>
      <circle cx="12" cy="12" r="8.4" />
      <path d="M4.4 6.6a9.4 9.4 0 0 1 15.2 0M4.4 17.4a9.4 9.4 0 0 0 15.2 0" />
    </svg>
  );
}

export function Verified({ size = 13 }: { size?: number }) {
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

export function Reply(p: I) {
  return (
    <svg viewBox="0 0 20 20" strokeWidth="1.55" {...stroke} {...p}>
      <path d="M17.5 9.5c0 3.7-3.4 6.7-7.5 6.7-1 0-2-.2-2.9-.5L3 17.2l1.5-3.4A6.3 6.3 0 0 1 2.5 9.5c0-3.7 3.4-6.7 7.5-6.7s7.5 3 7.5 6.7z" />
    </svg>
  );
}

export function Repost(p: I) {
  return (
    <svg viewBox="0 0 20 20" strokeWidth="1.55" {...stroke} {...p}>
      <path d="M3.8 8.5V6.8a2.4 2.4 0 0 1 2.4-2.4h7.4L11.4 2.2" />
      <path d="M16.2 11.5v1.7a2.4 2.4 0 0 1-2.4 2.4H6.4l2.2 2.2" />
    </svg>
  );
}

export function Heart({ filled, ...p }: I & { filled?: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill={filled ? "currentColor" : "none"}
      stroke={filled ? "none" : "currentColor"}
      strokeWidth="1.55"
      strokeLinejoin="round"
      aria-hidden
      {...p}
    >
      <path d="M10 16.6S2.6 12.4 2.6 7.8A3.9 3.9 0 0 1 10 5.9a3.9 3.9 0 0 1 7.4 1.9c0 4.6-7.4 8.8-7.4 8.8z" />
    </svg>
  );
}

export function CaretUp({ size = 9 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 8 8" aria-hidden>
      <path d="M4 1 7.4 6.8H0.6z" fill="var(--color-green-hi)" />
    </svg>
  );
}

export function CaretDown({ size = 9 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 8 8" aria-hidden>
      <path d="M4 7 0.6 1.2h6.8z" fill="var(--color-down)" />
    </svg>
  );
}

/* 탭바 */
export function TabHome({ active, ...p }: I & { active?: boolean }) {
  if (active) {
    return (
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...p}>
        <path d="M11.24 3.3a1.2 1.2 0 0 1 1.52 0l7.5 6.06c.28.23.44.57.44.93v9.06c0 .66-.54 1.2-1.2 1.2h-4.6v-5.7a.9.9 0 0 0-.9-.9h-4a.9.9 0 0 0-.9.9v5.7H4.5c-.66 0-1.2-.54-1.2-1.2v-9.06c0-.36.16-.7.44-.93z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" strokeWidth="1.9" {...stroke} {...p}>
      <path d="M3.5 10 12 3.7l8.5 6.3v9.4a1.2 1.2 0 0 1-1.2 1.2h-4.5v-6h-5.6v6H4.7a1.2 1.2 0 0 1-1.2-1.2z" />
    </svg>
  );
}

export function TabSearch({ active, ...p }: I & { active?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" strokeWidth={active ? 2.4 : 1.9} {...stroke} {...p}>
      <circle cx="10.6" cy="10.6" r="6.9" />
      <path d="M15.6 15.6 20.4 20.4" />
    </svg>
  );
}

export function TabCompose(p: I) {
  return (
    <svg viewBox="0 0 24 24" strokeWidth="2" {...stroke} {...p}>
      <path d="M16.4 4.4a2 2 0 0 1 2.8 2.8L9.5 16.9l-3.7 1 1-3.7z" />
      <path d="M14.6 6.2l3.2 3.2" />
    </svg>
  );
}

export function TabActivity({ active, ...p }: I & { active?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill={active ? "currentColor" : "none"}
      stroke={active ? "none" : "currentColor"}
      strokeWidth="1.9"
      strokeLinejoin="round"
      aria-hidden
      {...p}
    >
      <path d="M12 19.8S3.4 14.9 3.4 9.5A4.6 4.6 0 0 1 12 7.3a4.6 4.6 0 0 1 8.6 2.2c0 5.4-8.6 10.3-8.6 10.3z" />
    </svg>
  );
}

export function TabProfile({ active, ...p }: I & { active?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" strokeWidth={active ? 2.3 : 1.9} {...stroke} {...p}>
      <circle cx="12" cy="8.4" r="3.9" />
      <path d="M4.9 20.3c0-3.9 3.2-6.5 7.1-6.5s7.1 2.6 7.1 6.5" />
    </svg>
  );
}

const AVATAR_ICONS: Record<AvatarIcon, (p: I) => React.ReactElement> = {
  weather: Cloud,
  chart: Chart,
  play: Play,
  calendar: Calendar,
  box: Box,
  ball: BallOutline,
};

export function AvatarGlyph({
  name,
  className,
}: {
  name: AvatarIcon;
  className?: string;
}) {
  const C = AVATAR_ICONS[name];
  return <C className={className} />;
}
