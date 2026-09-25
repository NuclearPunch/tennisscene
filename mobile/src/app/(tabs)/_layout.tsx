import { NativeTabs } from "expo-router/unstable-native-tabs";
import { useColors } from "@/lib/theme";

/**
 * 앱 내비게이션(홈·검색·작성·활동·프로필). **콘텐츠 탭이 아니다**(CLAUDE.md 규칙 1).
 * 시스템 탭바를 쓴다 — iOS 에서는 떠 있는 유리 탭바가 된다. 쓰레드처럼 글자 없이 아이콘만.
 */
export default function TabLayout() {
  const c = useColors();
  return (
    <NativeTabs tintColor={c.ink} iconColor={{ default: c.ink3, selected: c.ink }} labelVisibilityMode="unlabeled">
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label hidden>홈</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: "house", selected: "house.fill" }} md="home" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="search">
        <NativeTabs.Trigger.Label hidden>검색</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="magnifyingglass" md="search" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="compose">
        <NativeTabs.Trigger.Label hidden>작성</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="plus" md="add" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="activity">
        <NativeTabs.Trigger.Label hidden>활동</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: "heart", selected: "heart.fill" }} md="favorite" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="me">
        <NativeTabs.Trigger.Label hidden>프로필</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: "person", selected: "person.fill" }} md="person" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
