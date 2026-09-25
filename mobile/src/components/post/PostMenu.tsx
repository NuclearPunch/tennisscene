import { router } from "expo-router";
import { DotsThree } from "phosphor-react-native";
import { useState } from "react";
import { Modal, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { T } from "@/components/T";
import { Button } from "@/components/ui";
import { isAnonymousAuthor, REPORT_REASONS, useModeration } from "@/lib/moderation";
import { HAIR, useColors } from "@/lib/theme";
import type { Post } from "@/lib/types";

/**
 * 글 메뉴 — 신고하기, 차단하기(애플 1.2). 웹 PostMenu 와 같은 흐름이다.
 * 내 글에는 없다. 익명 글은 신고만 된다. 로그인 전이면 프로필 탭(로그인)으로 보낸다.
 */
type Step = "menu" | "report" | "block" | { done: string; then: { postId?: string; blocks?: boolean } };

export function PostMenu({ post }: { post: Post }) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { report, block, hideLater, myHandle } = useModeration();
  const [step, setStep] = useState<Step | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const anon = isAnonymousAuthor(post);

  if (myHandle && post.author.handle === myHandle) return null;

  async function run(fn: () => Promise<string>, then: { postId?: string; blocks?: boolean }) {
    setBusy(true);
    setError(null);
    try {
      setStep({ done: await fn(), then });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const close = () => {
    // 확인 창을 닫을 때 화면에서 가린다.
    if (step && typeof step === "object") void hideLater(step.then);
    setStep(null);
    setError(null);
  };

  const row = { height: 52, justifyContent: "center", paddingHorizontal: 16, borderTopWidth: HAIR, borderTopColor: c.hairline } as const;

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="글 메뉴"
        hitSlop={10}
        onPress={() => (myHandle ? setStep("menu") : router.navigate("/me"))}
        style={{ marginLeft: "auto", paddingLeft: 8 }}
      >
        <DotsThree size={20} color={c.ink3} weight="bold" />
      </Pressable>

      <Modal visible={step !== null} transparent animationType="slide" onRequestClose={close}>
        <Pressable onPress={close} style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}>
          <Pressable onPress={() => {}} style={{ backgroundColor: c.bg, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingTop: 8, paddingBottom: Math.max(insets.bottom, 16) }}>
            {step === "menu" && (
              <>
                <Pressable style={[row, { borderTopWidth: 0 }]} onPress={() => setStep("report")}>
                  <T w="600" c="down">
                    신고하기
                  </T>
                </Pressable>
                {!anon && (
                  <Pressable style={row} onPress={() => setStep("block")}>
                    <T w="600">{`${post.author.name} 차단하기`}</T>
                  </Pressable>
                )}
                <Pressable style={row} onPress={close}>
                  <T c="ink3">취소</T>
                </Pressable>
              </>
            )}

            {step === "report" && (
              <>
                <T w="700" style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 }}>
                  신고하는 이유
                </T>
                {REPORT_REASONS.map((r) => (
                  <Pressable
                    key={r}
                    disabled={busy}
                    style={[row, { opacity: busy ? 0.4 : 1 }]}
                    onPress={() =>
                      void run(
                        async () =>
                          (await report(post.id, r)) === "again"
                            ? "이미 신고한 글입니다. 이 글은 더 이상 보이지 않습니다."
                            : "신고했습니다. 이 글은 더 이상 보이지 않고, 운영자가 확인합니다.",
                        { postId: post.id },
                      )
                    }
                  >
                    <T>{r}</T>
                  </Pressable>
                ))}
              </>
            )}

            {step === "block" && (
              <View style={{ paddingHorizontal: 16, paddingTop: 8, gap: 4 }}>
                <T w="700">{`${post.author.name} 님을 차단할까요?`}</T>
                <T c="ink3">이 계정의 글과 댓글이 내 화면에서 모두 사라집니다. 프로필에서 언제든 풀 수 있습니다.</T>
                <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Button big kind="line" label="취소" onPress={close} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Button
                      big
                      label="차단"
                      busy={busy}
                      onPress={() => void run(async () => (await block(post.author.handle), `${post.author.name} 님을 차단했습니다.`), { blocks: true })}
                    />
                  </View>
                </View>
              </View>
            )}

            {typeof step === "object" && step !== null && (
              <View style={{ paddingHorizontal: 16, paddingTop: 8, gap: 12 }}>
                <T>{step.done}</T>
                <Button big label="확인" onPress={close} />
              </View>
            )}

            {error ? (
              <T v="small" c="down" style={{ paddingHorizontal: 16, paddingTop: 8 }}>
                {error}
              </T>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
