import { router } from "expo-router";
import { Pressable, View } from "react-native";
import { Verified } from "@/components/Icons";
import { T } from "@/components/T";
import { HAIR, useColors } from "@/lib/theme";
import type { Post } from "@/lib/types";
import { Attachment } from "./Attachment";
import { Avatar } from "./Avatar";
import { PostActions } from "./PostActions";

/**
 * 봇·브랜드·유저가 전부 같은 틀을 쓴다. 구분은 이름 옆 배지 하나뿐이다(CLAUDE.md 규칙 2).
 * 웹의 PostCard 와 같은 구성이다.
 *
 * 본문을 누르면 상세(댓글)로 간다 — 쓰레드 앱과 같다.
 */
export function PostCard({ post, variant = "feed" }: { post: Post; variant?: "feed" | "thread" }) {
  const c = useColors();
  const open = variant === "feed" ? () => router.push(`/p/${post.id}`) : undefined;

  return (
    <View
      style={{
        flexDirection: "row",
        gap: 10,
        paddingHorizontal: 12,
        paddingTop: 12,
        paddingBottom: 4,
        borderBottomWidth: HAIR,
        borderBottomColor: c.hairline,
      }}
    >
      <Avatar author={post.author} />

      <View style={{ flex: 1, minWidth: 0 }}>
        <Pressable onPress={open} disabled={!open}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <T w="600" numberOfLines={1} style={{ flexShrink: 1 }}>
              {post.author.name}
            </T>
            {post.author.kind !== "user" && <Verified />}
            <T c="ink3">{post.timeLabel}</T>
          </View>

          {post.body ? <T>{post.body}</T> : null}
        </Pressable>

        {post.hashtag && (
          // 봇 계정 이름만으로는 안 갈린다 — '대회 알림' 이 일정도 결과도 올린다.
          <Pressable
            onPress={() => router.navigate({ pathname: "/", params: { tag: post.hashtag!.slug } })}
            hitSlop={6}
            style={{ alignSelf: "flex-start", marginTop: 2 }}
          >
            <T c="ink3">{`#${post.hashtag.label}`}</T>
          </Pressable>
        )}

        {post.attachment && <Attachment a={post.attachment} />}

        {post.quote && (
          <View style={{ marginTop: 8, borderWidth: HAIR, borderColor: c.hairline, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 }}>
            <T w="600">{post.quote.authorName}</T>
            <T c="ink2" style={{ marginTop: 4 }}>
              {post.quote.summary}
            </T>
          </View>
        )}

        {/* 봇 글 아래의 댓글 유도 줄. 빈 입력칸처럼 생겼다 — 여기에 쓰면 된다고 보여야 한다. */}
        {variant === "feed" && post.prompt ? (
          <Pressable
            onPress={open}
            style={{
              marginTop: 8,
              height: 40,
              justifyContent: "center",
              borderRadius: 20,
              borderWidth: HAIR,
              borderColor: c.hairline,
              paddingHorizontal: 14,
            }}
          >
            <T c="ink3" numberOfLines={1}>
              {post.prompt}
            </T>
          </Pressable>
        ) : null}

        <PostActions id={post.id} stats={post.stats} />
      </View>
    </View>
  );
}
