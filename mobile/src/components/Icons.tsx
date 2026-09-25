import {
  CalendarBlank,
  ChartBar,
  ChatCircle,
  CloudRain,
  Lightbulb,
  Package,
  Play,
  TennisBall,
} from "phosphor-react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { useColors } from "@/lib/theme";
import type { AvatarIcon } from "@/lib/types";

/**
 * 자동 게시 계정 배지 — 브랜드 요소라 직접 그린다(웹과 같은 도형).
 * 꽉 채운 원에 바탕색 체크여야 "인증" 으로 읽힌다.
 */
export function Verified({ size = 14 }: { size?: number }) {
  const c = useColors();
  return (
    <Svg width={size} height={size} viewBox="0 0 14 14" accessibilityLabel="자동 게시 계정">
      <Circle cx="7" cy="7" r="7" fill={c.accent} />
      <Path
        d="M4.1 7.2 6.1 9.1l3.8-4.1"
        fill="none"
        stroke={c.bg}
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

const GLYPH = {
  weather: CloudRain,
  chart: ChartBar,
  play: Play,
  calendar: CalendarBlank,
  box: Package,
  ball: TennisBall,
  tip: Lightbulb,
  chat: ChatCircle,
} as const;

/** 계정 아바타 위의 아이콘. 꽉 찬 원 위에 얹으므로 fill 이다. */
export function AvatarGlyph({ name, size, color }: { name: AvatarIcon; size: number; color: string }) {
  const C = GLYPH[name];
  return <C size={size} color={color} weight="fill" />;
}
