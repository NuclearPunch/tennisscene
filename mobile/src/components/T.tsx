import { Text, type TextProps } from "react-native";
import { type Colors, TYPE, useColors } from "@/lib/theme";

/**
 * 글자. 크기는 셋뿐이다(13·15·20). 이름·본문·시간이 전부 15 이고 굵기와 색으로만 가른다.
 * 한글은 어절 단위로 끊는다 — 글자 단위면 "선수입니 / 다." 처럼 마지막 글자가 떨어진다.
 */
type Props = TextProps & {
  v?: keyof typeof TYPE;
  c?: keyof Colors;
  w?: "400" | "600" | "700";
  color?: string;
};

export function T({ v = "body", c = "ink", w = "400", color, style, ...rest }: Props) {
  const colors = useColors();
  return (
    <Text
      {...rest}
      lineBreakStrategyIOS="hangul-word"
      style={[TYPE[v], { color: color ?? colors[c], fontWeight: w }, style]}
    />
  );
}
