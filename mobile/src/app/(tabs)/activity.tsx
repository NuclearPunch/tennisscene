import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Empty } from "@/components/ui";
import { useColors } from "@/lib/theme";

/** 웹과 같이 아직 비어 있다. 알림(F-4.2)을 붙일 때 채운다. */
export default function ActivityScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top }}>
      <Empty title="활동" note="내 글에 달린 댓글·좋아요·리포스트, 그리고 주간 랭킹 발표 알림이 모입니다." />
    </View>
  );
}
