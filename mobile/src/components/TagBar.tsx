import { X } from "phosphor-react-native";
import { Pressable, ScrollView, View } from "react-native";
import { T } from "@/components/T";
import { FEED_TAGS } from "@/lib/types";
import { HAIR, useColors } from "@/lib/theme";

/**
 * 해시태그 모아보기. **탭바가 아니다**(CLAUDE.md 규칙 1) — 기본으로 눌린 칩이 없다.
 * 걸린 칩에는 ✕ 를 달아 "다시 누르면 풀린다" 를 보인다.
 */
export function TagBar({ active, onChange }: { active: string | null; onChange: (slug: string | null) => void }) {
  const c = useColors();
  return (
    <View style={{ backgroundColor: c.bg, borderBottomWidth: HAIR, borderBottomColor: c.hairline }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingHorizontal: 12, paddingVertical: 10 }}>
        {FEED_TAGS.map((t) => {
          const on = t.slug === active;
          return (
            <Pressable
              key={t.slug}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              onPress={() => onChange(on ? null : t.slug)}
              style={{
                height: 34,
                flexDirection: "row",
                alignItems: "center",
                gap: 4,
                paddingHorizontal: 14,
                borderRadius: 17,
                backgroundColor: on ? c.ink : "transparent",
                borderWidth: on ? 0 : HAIR,
                borderColor: c.hairline,
              }}
            >
              <T w="600" color={on ? c.bg : c.ink}>{`#${t.label}`}</T>
              {on && <X size={14} color={c.bg} weight="bold" />}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
