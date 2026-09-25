import { useColorScheme } from "react-native";

/**
 * 웹과 같은 색이다(src/app/globals.css). 기준은 쓰레드 앱 — 흑백, 시스템 라이트/다크.
 * 색은 뜻이 있을 때만 쓴다: 배지, 좋아요, 순위 변동, 1위 표식.
 */
const light = {
  bg: "#ffffff",
  grouped: "#f5f5f5",
  hairline: "rgba(0,0,0,0.15)",
  ink: "#000000",
  ink2: "#424242",
  ink3: "#737373",
  muted: "#b8b8b8",
  accent: "#0f7a4f",
  up: "#16a06a",
  down: "#d64545",
};

const dark: typeof light = {
  bg: "#101010",
  grouped: "#1e1e1e",
  hairline: "rgba(243,245,247,0.15)",
  ink: "#f3f5f7",
  ink2: "#cccccc",
  ink3: "#8a8a8a",
  muted: "#4d4d4d",
  accent: "#35c48b",
  up: "#35c48b",
  down: "#ff6b5e",
};

/** 브랜드 두 색은 라이트·다크에서 같다. 아바타와 표식에만 쓴다. */
export const BRAND = { greenDeep: "#0b4a33", ball: "#d8f550" } as const;

export type Colors = typeof light;

export function useColors(): Colors {
  return useColorScheme() === "dark" ? dark : light;
}

/**
 * 글자 크기는 셋뿐이다: 13(메타) · 15(기본) · 20(카드의 주인공 한 줄). 사이 값은 만들지 않는다.
 * 줄높이 24 는 쓰레드 앱의 한글 줄간격을 화면에서 잰 비율(1.6)이다.
 */
export const TYPE = {
  small: { fontSize: 13, lineHeight: 18 },
  body: { fontSize: 15, lineHeight: 24 },
  lead: { fontSize: 20, lineHeight: 26, letterSpacing: -0.2 },
} as const;

/** 테두리는 0.5pt 선. 쓰레드의 링크 미리보기와 같은 무게다. */
export const HAIR = 0.5;
export const RADIUS = { card: 12, media: 8 } as const;
