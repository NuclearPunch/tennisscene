import Svg, { Circle, ClipPath, Defs, G, Path } from "react-native-svg";
import { useColors } from "@/lib/theme";
import { GLYPHS, SEAM } from "./logoPaths";

/**
 * 웹과 같은 로고 — 단색 선 심벌 + 굵고 기운 워드마크(배민 한나체 Pro 윤곽선).
 * 색이 없다. 라이트에서는 검정, 다크에서는 흰색이다.
 */
function Ball({ color, id }: { color: string; id: string }) {
  return (
    <>
      <Defs>
        <ClipPath id={id}>
          <Circle cx="50" cy="50" r="43.5" />
        </ClipPath>
      </Defs>
      <Circle cx="50" cy="50" r="43.5" fill="none" stroke={color} strokeWidth="13" />
      <Path d={SEAM} fill="none" stroke={color} strokeWidth="13" clipPath={`url(#${id})`} />
    </>
  );
}

export function Logo({ height = 26 }: { height?: number }) {
  const c = useColors();
  return (
    <Svg height={height} width={(height * 4351) / 962} viewBox="0 0 4351 962" accessibilityLabel="테니스씬">
      <G transform="translate(0 60) scale(8.42)">
        <Ball color={c.ink} id={`logo-${height}`} />
      </G>
      <G transform="translate(972 790) skewX(-10) scale(1 -1)" fill={c.ink}>
        {GLYPHS.map(([x, d]) => (
          <Path key={x} d={d} transform={`translate(${x} 0)`} />
        ))}
      </G>
    </Svg>
  );
}
