"use client";

import { useRouter } from "next/navigation";
import { useLayoutEffect, useRef, useState } from "react";
import { Avatar } from "@/components/post/Avatar";
import { LoginSheet } from "@/components/LoginSheet";
import { COUNTER_FROM, countChars, normalizeBody, POST_MAX } from "@/lib/postInput";
import { useMe } from "@/lib/me";
import { browserClient } from "@/lib/supabase-browser";

/**
 * 댓글 입력줄. 상세 화면의 글 바로 밑에 붙는다.
 *
 * 비회원에게도 **보인다.** 눌러야 로그인 시트가 뜬다 —
 * 입력칸이 아예 없으면 여기서 이야기할 수 있다는 걸 모른다.
 */
export function CommentComposer({
  postId,
  placeholder,
}: {
  postId: string;
  /** 피드에서 보던 유도 질문. 없으면 기본 문구. */
  placeholder?: string;
}) {
  const router = useRouter();
  const { me } = useMe();
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [login, setLogin] = useState(false);
  const area = useRef<HTMLTextAreaElement>(null);

  // 입력창은 내용만큼 자란다.
  useLayoutEffect(() => {
    const el = area.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [body]);

  const used = countChars(normalizeBody(body));
  const left = POST_MAX - used;
  const account = me.status === "ready" ? me.account : null;

  async function send() {
    if (used === 0 || left < 0 || busy) return;
    if (!account) return setLogin(true);

    setBusy(true);
    setError(null);
    try {
      // 토큰은 보내는 순간에 꺼낸다. 화면을 오래 열어두면 처음 받은 건 만료돼 있다.
      const { data } = await browserClient().auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("로그인이 만료됐습니다. 다시 로그인해주세요");

      const res = await fetch(`/api/posts/${postId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ body }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? "댓글을 올리지 못했습니다");
      }
      setBody("");
      router.refresh(); // 댓글 목록은 서버에서 그린다
    } catch (e) {
      setError(e instanceof Error ? e.message : "댓글을 올리지 못했습니다");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="hair-b flex gap-2.5 px-3 py-3">
        {account ? (
          <Avatar author={account} size={36} />
        ) : (
          <span className="h-9 w-9 shrink-0 rounded-full bg-grouped" />
        )}
        <div className="min-w-0 grow">
          <label htmlFor="comment" className="sr-only">
            댓글
          </label>
          <textarea
            id="comment"
            ref={area}
            rows={1}
            value={body}
            placeholder={placeholder ?? "댓글 남기기"}
            onFocus={() => {
              if (me.status === "guest" || me.status === "needs-profile") setLogin(true);
            }}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") void send();
            }}
            className="block w-full resize-none overflow-hidden bg-transparent outline-none placeholder:text-ink-3"
          />
          {error && (
            <p role="alert" className="mt-1 text-[13px] leading-[18px] text-down">
              {error}
            </p>
          )}
        </div>

        {left <= COUNTER_FROM && (
          <span className={`num shrink-0 ${left < 0 ? "text-down" : "text-ink-3"}`}>{left}</span>
        )}
        {used > 0 && (
          <button
            type="button"
            onClick={() => void send()}
            disabled={left < 0 || busy}
            className="h-9 shrink-0 cursor-pointer self-end rounded-full bg-ink px-4 font-semibold text-bg disabled:opacity-30"
          >
            {busy ? "..." : "남기기"}
          </button>
        )}
      </div>

      <LoginSheet open={login} onClose={() => setLogin(false)} />
    </>
  );
}
