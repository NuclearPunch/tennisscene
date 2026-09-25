"use client";

import { useEffect, useState } from "react";
import { More } from "@/components/icons";
import {
  isAnonymousAuthor,
  REPORT_REASONS,
  useModeration,
} from "@/lib/moderationClient";
import type { Post } from "@/lib/types";

/**
 * 글 메뉴 — 신고하기, 차단하기. 애플 1.2 가 요구하는 두 가지다.
 *
 * 내 글에는 없다. 익명 글은 신고만 된다(차단은 익명 역추적 통로가 된다).
 * 결과는 바로 보인다 — 신고한 글, 차단한 사람의 글은 그 자리에서 사라진다.
 */
type Step =
  | "menu"
  | "report"
  | "block"
  | { done: string; then: { postId?: string; blocks?: boolean } };

const ITEM = "flex h-12 w-full cursor-pointer items-center px-4 text-left";

export function PostMenu({ post }: { post: Post }) {
  const { report, block, hideLater, signedIn, myHandle } = useModeration();
  const [step, setStep] = useState<Step | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const anon = isAnonymousAuthor(post);

  useEffect(() => {
    if (!step) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setStep(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step]);

  if (myHandle && post.author.handle === myHandle) return null;

  async function run(
    fn: () => Promise<string>,
    then: { postId?: string; blocks?: boolean },
  ) {
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
    // 확인 창을 닫을 때 화면에서 가린다. 먼저 가리면 이 창도 같이 사라진다.
    if (step && typeof step === "object") void hideLater(step.then);
    setStep(null);
    setError(null);
  };

  return (
    <>
      <button
        type="button"
        aria-label="글 메뉴"
        onClick={() => signedIn() && setStep("menu")}
        className="-mr-1.5 ml-auto flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center text-ink-3"
      >
        <More className="h-5 w-5" />
      </button>

      {step && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-30 flex items-end justify-center bg-black/50"
          onClick={close}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[520px] rounded-t-[20px] bg-bg pt-2 pb-[max(env(safe-area-inset-bottom),16px)]"
          >
            {step === "menu" && (
              <>
                <button
                  type="button"
                  className={`${ITEM} font-semibold text-down`}
                  onClick={() => setStep("report")}
                >
                  신고하기
                </button>
                {!anon && (
                  <button
                    type="button"
                    className={`${ITEM} hair-t font-semibold`}
                    onClick={() => setStep("block")}
                  >
                    {`${post.author.name} 차단하기`}
                  </button>
                )}
                <button
                  type="button"
                  className={`${ITEM} hair-t text-ink-3`}
                  onClick={close}
                >
                  취소
                </button>
              </>
            )}

            {step === "report" && (
              <>
                <p className="px-4 pt-2 pb-3 font-bold">신고하는 이유</p>
                {REPORT_REASONS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    disabled={busy}
                    className={`${ITEM} hair-t disabled:opacity-40`}
                    onClick={() =>
                      void run(
                        async () =>
                          (await report(post.id, r)) === "again"
                            ? "이미 신고한 글입니다. 이 글은 더 이상 보이지 않습니다."
                            : "신고했습니다. 이 글은 더 이상 보이지 않고, 운영자가 확인합니다.",
                        { postId: post.id },
                      )
                    }
                  >
                    {r}
                  </button>
                ))}
              </>
            )}

            {step === "block" && (
              <div className="px-4 pt-2">
                <p className="font-bold">{`${post.author.name} 님을 차단할까요?`}</p>
                <p className="mt-1 text-ink-3">
                  이 계정의 글과 댓글이 내 화면에서 모두 사라집니다. 프로필에서
                  언제든 풀 수 있습니다.
                </p>
                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    onClick={close}
                    className="hair h-11 grow cursor-pointer rounded-card font-semibold"
                  >
                    취소
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      void run(
                        async () => (
                          await block(post.author.handle),
                          `${post.author.name} 님을 차단했습니다.`
                        ),
                        { blocks: true },
                      )
                    }
                    className="h-11 grow cursor-pointer rounded-card bg-ink font-semibold text-bg disabled:opacity-40"
                  >
                    차단
                  </button>
                </div>
              </div>
            )}

            {typeof step === "object" && (
              <div className="px-4 pt-2">
                <p>{step.done}</p>
                <button
                  type="button"
                  onClick={close}
                  className="mt-4 h-11 w-full cursor-pointer rounded-card bg-ink font-semibold text-bg"
                >
                  확인
                </button>
              </div>
            )}

            {error && (
              <p className="px-4 pt-2 text-[13px] leading-[18px] text-down">
                {error}
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}

/** 신고했거나 차단한 사람의 글이면 아예 그리지 않는다. PostCard 가 이걸로 감싼다. */
export function Moderated({
  post,
  children,
}: {
  post: Post;
  children: React.ReactNode;
}) {
  const { hidden } = useModeration();
  return hidden(post) ? null : <>{children}</>;
}
