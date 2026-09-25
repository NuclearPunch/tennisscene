import { TabList, TabSlot, TabTrigger, type TabTriggerSlotProps, Tabs } from "expo-router/ui";
import { House, Heart, MagnifyingGlass, Plus, User } from "phosphor-react-native";
import { forwardRef } from "react";
import { Pressable, View } from "react-native";
import { HAIR, useColors } from "@/lib/theme";

/**
 * 브라우저로 띄웠을 때(개발 확인용)의 탭바. 시스템 탭바가 없어서 웹 앱과 같은 떠 있는 탭바를 그린다.
 * 폰에서는 _layout.tsx 의 네이티브 탭바가 쓰인다.
 */
const ICONS = { index: House, search: MagnifyingGlass, compose: Plus, activity: Heart, me: User } as const;

const TabButton = forwardRef<View, TabTriggerSlotProps & { icon: keyof typeof ICONS }>(function TabButton(
  { isFocused, icon, ...props },
  ref,
) {
  const c = useColors();
  const Icon = ICONS[icon];
  return (
    <Pressable ref={ref} {...props} style={{ flex: 1, height: 52, alignItems: "center", justifyContent: "center" }}>
      <Icon size={26} color={isFocused ? c.ink : c.ink3} weight={isFocused && icon !== "search" && icon !== "compose" ? "fill" : "regular"} />
    </Pressable>
  );
});

export default function WebTabs() {
  const c = useColors();
  return (
    <Tabs>
      <TabSlot style={{ flex: 1 }} />
      <TabList asChild>
        <View
          style={{
            position: "absolute",
            left: 16,
            right: 16,
            bottom: 16,
            flexDirection: "row",
            borderRadius: 30,
            backgroundColor: c.grouped,
            borderWidth: HAIR,
            borderColor: c.hairline,
            maxWidth: 480,
            alignSelf: "center",
          }}
        >
          <TabTrigger name="index" href="/" asChild>
            <TabButton icon="index" />
          </TabTrigger>
          <TabTrigger name="search" href="/search" asChild>
            <TabButton icon="search" />
          </TabTrigger>
          <TabTrigger name="compose" href="/compose" asChild>
            <TabButton icon="compose" />
          </TabTrigger>
          <TabTrigger name="activity" href="/activity" asChild>
            <TabButton icon="activity" />
          </TabTrigger>
          <TabTrigger name="me" href="/me" asChild>
            <TabButton icon="me" />
          </TabTrigger>
        </View>
      </TabList>
    </Tabs>
  );
}
