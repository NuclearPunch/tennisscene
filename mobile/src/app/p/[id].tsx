import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PostCard } from "@/components/post/PostCard";
import { T } from "@/components/T";
import { Button, Empty } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { feedChanged } from "@/lib/events";
import { useMe } from "@/lib/me";
import { useReactions } from "@/lib/reactions";
import { HAIR, TYPE, useColors } from "@/lib/theme";
import type { Post } from "@/lib/types";

/**
 * 글 하나와 댓글. 댓글은 **오래된 순**이다 — 피드는 최신순이지만 댓글은 대화라 위에서 아래로 읽힌다.
 * 댓글 입력칸은 화면 아래에 붙어 있고, 키보드가 올라오면 같이 올라간다.
 */
export default function ThreadScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const c = useColors();
  const { hydrate } = useReactions();
  const [thread, setThread] = useState<{ post: Post; comments: Post[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const show = useCallback(
    (t: { post: Post; comments: Post[] }) => {
      setThread(t);
      setError(null);
      void hydrate([t.post.id, ...t.comments.map((x) => x.id)]);
    },
    [hydrate],
  );
  const fail = (e: unknown) =>
    setError(e instanceof ApiError && e.status === 404 ? "없거나 지워진 글입니다" : "불러오지 못했습니다");

  /** 댓글을 단 뒤 다시 받는다. */
  const load = useCallback(async () => {
    try {
      show(await api.thread(id));
    } catch (e) {
      fail(e);
    }
  }, [id, show]);

  useEffect(() => {
    let alive = true;
    api.thread(id).then(
      (t) => alive && show(t),
      (e) => alive && fail(e),
    );
    return () => {
      alive = false;
    };
  }, [id, show]);

  if (error) return <Empty note={error} />;
  if (!thread) return <ActivityIndicator style={{ paddingVertical: 32 }} color={c.ink3} />;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0} style={{ flex: 1 }}>
      <FlatList
        data={thread.comments}
        keyExtractor={(p) => p.id}
        ListHeaderComponent={<PostCard post={thread.post} variant="thread" />}
        renderItem={({ item }) => <PostCard post={item} variant="thread" />}
        ListEmptyComponent={
          <T c="ink3" style={{ textAlign: "center", paddingVertical: 32 }}>
            첫 댓글을 남겨 보세요
          </T>
        }
        keyboardDismissMode="interactive"
      />
      <CommentBox postId={thread.post.id} placeholder={thread.post.prompt} onPosted={load} />
    </KeyboardAvoidingView>
  );
}

function CommentBox({ postId, placeholder, onPosted }: { postId: string; placeholder?: string; onPosted: () => Promise<void> }) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { me } = useMe();
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    if (me.status !== "ready") return router.navigate("/me");
    setBusy(true);
    setError(null);
    try {
      await api.comment(postId, body.trim());
      setBody("");
      await onPosted();
      feedChanged.emit(); // 피드의 댓글 수도 새로
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ borderTopWidth: HAIR, borderTopColor: c.hairline, backgroundColor: c.bg, paddingHorizontal: 12, paddingTop: 8, paddingBottom: Math.max(insets.bottom, 8) }}>
      {error ? (
        <T v="small" c="down" style={{ paddingBottom: 4 }}>
          {error}
        </T>
      ) : null}
      <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8 }}>
        <TextInput
          value={body}
          onChangeText={setBody}
          // 봇 글이면 댓글 유도 질문이 안내문으로 들어간다.
          placeholder={me.status === "ready" ? (placeholder ?? "댓글 달기") : "로그인하고 댓글 달기"}
          placeholderTextColor={c.ink3}
          multiline
          maxLength={500}
          onFocus={() => me.status !== "ready" && me.status !== "loading" && router.navigate("/me")}
          style={[TYPE.body, { flex: 1, maxHeight: 120, minHeight: 40, borderRadius: 20, backgroundColor: c.grouped, paddingHorizontal: 14, paddingTop: 8, paddingBottom: 8, color: c.ink }]}
        />
        <Button label="게시" onPress={() => void send()} busy={busy} disabled={!body.trim()} />
      </View>
    </View>
  );
}
