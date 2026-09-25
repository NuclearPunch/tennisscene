import { View } from "react-native";
import { AvatarGlyph } from "@/components/Icons";
import { T } from "@/components/T";
import { BRAND, useColors } from "@/lib/theme";
import type { Author } from "@/lib/types";

/**
 * 자동 게시 계정은 꽉 찬 원이다. 공식 계정의 프로필 사진은 로고이고, 로고는 단색으로 꽉 차 있다.
 */
export function Avatar({ author, size = 36 }: { author: Author; size?: number }) {
  const c = useColors();
  const tone = {
    green: { bg: BRAND.greenDeep, fg: BRAND.ball },
    ball: { bg: BRAND.ball, fg: BRAND.greenDeep },
    neutral: { bg: c.grouped, fg: c.ink2 },
  }[author.tone];

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: tone.bg,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {author.icon ? (
        <AvatarGlyph name={author.icon} size={size / 2} color={tone.fg} />
      ) : (
        <T w="600" color={tone.fg} style={{ fontSize: size * 0.42, lineHeight: size * 0.6 }}>
          {author.initial}
        </T>
      )}
    </View>
  );
}
