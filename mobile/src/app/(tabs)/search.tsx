import { router } from "expo-router";
import { MagnifyingGlass, X } from "phosphor-react-native";
import { useState } from "react";
import { ActivityIndicator, FlatList, Pressable, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PostCard } from "@/components/post/PostCard";
import { T } from "@/components/T";
import { api } from "@/lib/api";
import { useReactions } from "@/lib/reactions";
import { HAIR, TYPE, useColors } from "@/lib/theme";
import { FEED_TAGS, type Post } from "@/lib/types";

/**
 * 검색. 웹과 같은 서버 함수를 쓴다 — 대회·선수·소속·영상 제목, 같은 부서의 다른 이름까지.
 * **치는 대로 찾지 않는다.** 한글 입력은 자모마다 바뀌어서 "ㅅ" "서" "성" 마다 요청이 나간다.
 * 키보드의 검색 버튼을 눌렀을 때만 찾는다.
 */
export default function SearchScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { hydrate } = useReactions();
  const [q, setQ] = useState("");
  const [result, setResult] = useState<{ term: string; posts: Post[]; also: string[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    const term = q.trim();
    if (term.length < 2) return setError("두 글자부터 찾습니다");
    setBusy(true);
    setError(null);
    try {
      const r = await api.search(term);
      setResult({ term, posts: r.posts, also: r.also });
      void hydrate(r.posts.map((p) => p.id));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top }}>
      <View style={{ paddingHorizontal: 12, paddingVertical: 8 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, height: 40, borderRadius: 12, backgroundColor: c.grouped, paddingHorizontal: 12 }}>
          <MagnifyingGlass size={18} color={c.ink3} />
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="대회·선수·소속·영상 제목"
            placeholderTextColor={c.ink3}
            returnKeyType="search"
            onSubmitEditing={() => void run()}
            autoCorrect={false}
            style={[TYPE.body, { flex: 1, color: c.ink, paddingVertical: 0 }]}
          />
          {q ? (
            <Pressable
              onPress={() => {
                setQ("");
                setResult(null);
                setError(null);
              }}
              hitSlop={8}
            >
              <X size={16} color={c.ink3} weight="bold" />
            </Pressable>
          ) : null}
        </View>
      </View>

      {busy ? (
        <ActivityIndicator style={{ paddingVertical: 24 }} color={c.ink3} />
      ) : error ? (
        <T c="ink3" style={{ paddingHorizontal: 12, paddingVertical: 16 }}>
          {error}
        </T>
      ) : !result ? (
        <View style={{ paddingHorizontal: 12, paddingTop: 16 }}>
          <T c="ink3">대회·선수·소속·영상 제목으로 찾습니다. 두 글자부터요.</T>
          <T w="600" style={{ marginTop: 24, marginBottom: 8 }}>
            종류별로 모아 보기
          </T>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {FEED_TAGS.map((t) => (
              <Pressable
                key={t.slug}
                onPress={() => router.navigate({ pathname: "/", params: { tag: t.slug } })}
                style={{ height: 34, justifyContent: "center", paddingHorizontal: 14, borderRadius: 17, borderWidth: HAIR, borderColor: c.hairline }}
              >
                <T w="600">{`#${t.label}`}</T>
              </Pressable>
            ))}
          </View>
        </View>
      ) : (
        <FlatList
          data={result.posts}
          keyExtractor={(p) => p.id}
          keyboardDismissMode="on-drag"
          ListHeaderComponent={
            result.posts.length ? (
              <T v="small" c="ink3" style={{ paddingHorizontal: 12, paddingBottom: 8 }}>
                {`${result.posts.length}건`}
                {/* 같은 부서의 다른 이름으로도 찾았다고 알린다. 안 그러면 검색이 고장 난 줄 안다. */}
                {result.also.length ? ` · ${result.also.join(", ")}도 같은 부서라 함께 찾았습니다` : ""}
              </T>
            ) : null
          }
          ListEmptyComponent={
            <T c="ink3" style={{ textAlign: "center", paddingVertical: 40 }}>
              {`'${result.term}' 로 찾은 글이 없습니다`}
            </T>
          }
          renderItem={({ item }) => <PostCard post={item} />}
        />
      )}
    </View>
  );
}
