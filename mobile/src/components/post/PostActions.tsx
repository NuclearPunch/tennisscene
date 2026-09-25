import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { ChatCircle, Heart, PaperPlaneTilt, Repeat } from "phosphor-react-native";
import { Platform, Pressable, Share, View } from "react-native";
import { T } from "@/components/T";
import { webUrl } from "@/lib/api";
import { useReactions } from "@/lib/reactions";
import { useColors } from "@/lib/theme";
import type { PostStats } from "@/lib/types";

/** 0 은 안 쓴다. 새 글마다 "0 0 0" 이 붙어 있으면 조용한 서비스라는 걸 광고하는 셈이다. */
function Count({ n }: { n: number }) {
  if (n <= 0) return null;
  return <T c="ink3">{String(n)}</T>;
}

/** 누른 느낌. 웹에는 없는, 앱이라서 줄 수 있는 것. */
function tap() {
  if (Platform.OS !== "web") void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

export function PostActions({ id, stats }: { id: string; stats: PostStats }) {
  const c = useColors();
  const { on, delta, toggle } = useReactions();
  const liked = on("like", id);
  const reposted = on("repost", id);

  // 터치 영역은 40pt, 아이콘은 22pt. 첫 아이콘이 본문 왼쪽 선에 맞도록 줄 전체를 8pt 당긴다.
  const btn = { height: 40, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 8 } as const;

  return (
    <View style={{ marginLeft: -8, marginTop: 2, flexDirection: "row", alignItems: "center", gap: 12 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={liked ? "좋아요 취소" : "좋아요"}
        onPress={() => {
          tap();
          toggle("like", id);
        }}
        style={btn}
      >
        <Heart size={22} color={liked ? c.accent : c.ink2} weight={liked ? "fill" : "regular"} />
        <Count n={stats.likes + delta("like", id)} />
      </Pressable>

      <Pressable accessibilityRole="button" accessibilityLabel={`댓글 ${stats.replies}개`} onPress={() => router.push(`/p/${id}`)} style={btn}>
        <ChatCircle size={22} color={c.ink2} />
        <Count n={stats.replies} />
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={reposted ? "리포스트 취소" : "리포스트"}
        onPress={() => {
          tap();
          toggle("repost", id);
        }}
        style={btn}
      >
        <Repeat size={22} color={reposted ? c.accent : c.ink2} />
        <Count n={stats.reposts + delta("repost", id)} />
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="공유"
        // 폰의 공유 시트. 카톡으로 보내면 웹 주소가 가서 앱이 없는 사람도 볼 수 있다.
        onPress={() => void Share.share({ message: webUrl(`/p/${id}`), url: webUrl(`/p/${id}`) }).catch(() => {})}
        style={btn}
      >
        <PaperPlaneTilt size={22} color={c.ink2} />
      </Pressable>
    </View>
  );
}
