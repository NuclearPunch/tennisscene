import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Logo } from "@/components/brand/Logo";
import { Avatar } from "@/components/post/Avatar";
import { PostCard } from "@/components/post/PostCard";
import { T } from "@/components/T";
import { TagBar } from "@/components/TagBar";
import { Button } from "@/components/ui";
import { api } from "@/lib/api";
import { feedChanged } from "@/lib/events";
import { useMe } from "@/lib/me";
import { useReactions } from "@/lib/reactions";
import { HAIR, useColors } from "@/lib/theme";
import { FEED_TAGS, type FeedPage, type Post } from "@/lib/types";

/**
 * 시간순 단일 피드(CLAUDE.md 규칙 1·5). 웹의 FeedStream 과 같은 규칙이다.
 *
 * 커서는 created_at 이다 — offset 이면 새 글이 들어올 때 같은 글이 두 번 나오거나 빠진다.
 * 걸린 해시태그는 화면 상태가 아니라 **주소(params)** 에 둔다. 다른 화면의 #대회결과 를 눌러도
 * 여기로 와서 걸린다.
 */

type Row = { kind: "head" } | { kind: "tags" } | { kind: "post"; post: Post };

export default function FeedScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ tag?: string }>();
  const tag = FEED_TAGS.some((t) => t.slug === params.tag) ? params.tag! : null;
  const { hydrate } = useReactions();

  const [posts, setPosts] = useState<Post[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "idle" | "more" | "failed">("loading");
  const [refreshing, setRefreshing] = useState(false);
  /** 태그를 빠르게 바꾸면 앞선 요청이 늦게 와서 지금 목록을 덮을 수 있다. 마지막 요청만 받는다. */
  const req = useRef(0);

  const show = useCallback(
    (page: FeedPage) => {
      setPosts(page.posts);
      setCursor(page.nextCursor);
      setStatus("idle");
      void hydrate(page.posts.map((p) => p.id));
    },
    [hydrate],
  );

  const loadFirst = useCallback(async () => {
    const id = ++req.current;
    try {
      const page = await api.feed(null, tag);
      if (id === req.current) show(page);
    } catch {
      if (id === req.current) setStatus("failed");
    }
  }, [tag, show]);

  // 첫 장. 받은 뒤 콜백에서만 상태를 바꾼다.
  useEffect(() => {
    const id = ++req.current;
    api.feed(null, tag).then(
      (page) => id === req.current && show(page),
      () => id === req.current && setStatus("failed"),
    );
  }, [tag, show]);

  // 글을 쓰고 오면 처음부터 다시 받는다.
  useEffect(() => feedChanged.on(() => void loadFirst()), [loadFirst]);

  const loadMore = useCallback(async () => {
    if (!cursor || status !== "idle") return;
    const id = req.current;
    setStatus("more");
    try {
      const page = await api.feed(cursor, tag);
      if (id !== req.current) return;
      // 서버가 같은 글을 다시 주면 거른다. 중복 key 로 목록이 깨지는 게 더 나쁘다.
      setPosts((prev) => {
        const seen = new Set(prev.map((p) => p.id));
        return [...prev, ...page.posts.filter((p) => !seen.has(p.id))];
      });
      setCursor(page.nextCursor);
      setStatus("idle");
      void hydrate(page.posts.map((p) => p.id));
    } catch {
      if (id === req.current) setStatus("failed");
    }
  }, [cursor, status, tag, hydrate]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await loadFirst();
    setRefreshing(false);
  }, [loadFirst]);

  const setTag = (slug: string | null) => {
    setStatus("loading");
    setPosts([]);
    router.setParams({ tag: slug ?? undefined });
  };

  const rows: Row[] = [{ kind: "head" }, { kind: "tags" }, ...posts.map((post) => ({ kind: "post" as const, post }))];
  const label = FEED_TAGS.find((t) => t.slug === tag)?.label;

  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top }}>
      <FlatList
        data={rows}
        keyExtractor={(r) => (r.kind === "post" ? r.post.id : r.kind)}
        // 해시태그 줄은 스크롤해도 위에 붙어 있다. 로고는 쓰레드처럼 같이 올라간다.
        stickyHeaderIndices={[1]}
        renderItem={({ item }) =>
          item.kind === "head" ? (
            <Head />
          ) : item.kind === "tags" ? (
            <TagBar active={tag} onChange={setTag} />
          ) : (
            <PostCard post={item.post} />
          )
        }
        onEndReached={() => void loadMore()}
        onEndReachedThreshold={1.5}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={c.ink3} />}
        ListFooterComponent={
          status === "loading" || status === "more" ? (
            <ActivityIndicator style={{ paddingVertical: 24 }} color={c.ink3} />
          ) : status === "failed" ? (
            <View style={{ alignItems: "center", gap: 12, paddingVertical: 24 }}>
              <T c="ink3">불러오지 못했습니다</T>
              <Button kind="line" label="다시 시도" onPress={() => void (posts.length ? loadMore() : loadFirst())} />
            </View>
          ) : posts.length === 0 ? (
            <View style={{ alignItems: "center", gap: 12, paddingVertical: 64 }}>
              <T c="ink3">{label ? `#${label} 로 모인 글이 아직 없습니다` : "올라온 글이 없습니다"}</T>
              {tag && <Button kind="line" label="전체 보기" onPress={() => setTag(null)} />}
            </View>
          ) : !cursor ? (
            // 끝을 알려준다. 오래된 글을 무한히 되감아 보여주지 않는다.
            <T v="small" c="muted" style={{ textAlign: "center", paddingVertical: 32 }}>
              여기까지입니다
            </T>
          ) : null
        }
      />
    </View>
  );
}

/** 로고와 글쓰기 유도 줄. 누르면 작성 탭으로 간다. */
function Head() {
  const c = useColors();
  const { me } = useMe();
  return (
    <View style={{ backgroundColor: c.bg }}>
      <View style={{ height: 52, alignItems: "center", justifyContent: "center" }}>
        <Logo height={26} />
      </View>
      <Pressable
        onPress={() => router.navigate("/compose")}
        style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, paddingBottom: 12, borderBottomWidth: HAIR, borderBottomColor: c.hairline }}
      >
        {me.status === "ready" ? (
          <Avatar author={me.account} size={36} />
        ) : (
          <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: c.grouped }} />
        )}
        <T c="ink3">오늘 코트에서 무슨 일이 있었나요?</T>
      </Pressable>
    </View>
  );
}
