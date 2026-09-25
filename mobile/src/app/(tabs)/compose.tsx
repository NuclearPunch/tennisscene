import { router, useFocusEffect } from "expo-router";
import { EyeSlash } from "phosphor-react-native";
import { useCallback, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AuthGate } from "@/components/AuthGate";
import { Avatar } from "@/components/post/Avatar";
import { T } from "@/components/T";
import { Button } from "@/components/ui";
import { api } from "@/lib/api";
import { feedChanged } from "@/lib/events";
import { HAIR, TYPE, useColors } from "@/lib/theme";
import type { Author } from "@/lib/types";

/** DB 의 `check (char_length(body) <= 500)` 과 같다(웹 src/lib/postInput.ts). */
const MAX = 500;

/**
 * 글쓰기. 탭바의 "+" 가 바로 이 화면이다. 로그인하지 않았으면 같은 자리에서 문(AuthGate)이 먼저 나온다.
 * 익명은 글마다 고른다 — 블라인드 같은 고민 글은 익명이어야 쓴다.
 */
export default function ComposeScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top }}>
      <AuthGate purpose="write">{(me) => <Composer account={me.account} />}</AuthGate>
    </View>
  );
}

function Composer({ account }: { account: Author }) {
  const c = useColors();
  const [body, setBody] = useState("");
  const [anon, setAnon] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<TextInput>(null);

  // 탭에 들어오면 바로 쓸 수 있게 키보드를 올린다.
  useFocusEffect(
    useCallback(() => {
      const t = setTimeout(() => input.current?.focus(), 250);
      return () => clearTimeout(t);
    }, []),
  );

  const text = body.trim();
  const over = body.length > MAX;

  async function post() {
    setBusy(true);
    setError(null);
    try {
      await api.write(text, anon);
      setBody("");
      setAnon(false);
      feedChanged.emit();
      router.navigate("/");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
      <View style={{ height: 52, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, borderBottomWidth: HAIR, borderBottomColor: c.hairline }}>
        <Pressable onPress={() => router.navigate("/")} hitSlop={8}>
          <T>취소</T>
        </Pressable>
        <T w="700">새 글</T>
        <Button label="게시" onPress={() => void post()} busy={busy} disabled={!text || over} />
      </View>

      <View style={{ flexDirection: "row", gap: 10, padding: 12 }}>
        {anon ? (
          <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: c.grouped, alignItems: "center", justifyContent: "center" }}>
            <EyeSlash size={18} color={c.ink2} />
          </View>
        ) : (
          <Avatar author={account} size={36} />
        )}
        <View style={{ flex: 1 }}>
          <T w="600">{anon ? "익명" : account.name}</T>
          <TextInput
            ref={input}
            value={body}
            onChangeText={setBody}
            placeholder="오늘 코트에서 무슨 일이 있었나요?"
            placeholderTextColor={c.ink3}
            multiline
            style={[TYPE.body, { color: c.ink, minHeight: 120, textAlignVertical: "top", paddingTop: 2 }]}
          />
        </View>
      </View>

      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingVertical: 8, marginTop: "auto", borderTopWidth: HAIR, borderTopColor: c.hairline }}>
        <Pressable
          accessibilityRole="switch"
          accessibilityState={{ checked: anon }}
          onPress={() => setAnon(!anon)}
          style={{ flexDirection: "row", alignItems: "center", gap: 6, height: 34, paddingHorizontal: 12, borderRadius: 17, backgroundColor: anon ? c.ink : "transparent", borderWidth: anon ? 0 : HAIR, borderColor: c.hairline }}
        >
          <EyeSlash size={16} color={anon ? c.bg : c.ink} />
          <T w="600" color={anon ? c.bg : c.ink}>
            익명
          </T>
        </Pressable>
        <T v="small" c={over ? "down" : "ink3"}>{`${body.length}/${MAX}`}</T>
      </View>
      {error ? (
        <T v="small" c="down" style={{ paddingHorizontal: 12, paddingBottom: 8 }}>
          {error}
        </T>
      ) : null}
    </KeyboardAvoidingView>
  );
}
