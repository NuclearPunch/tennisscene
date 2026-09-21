"use client";

import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Avatar } from "@/components/post/Avatar";
import { Incognito } from "@/components/icons";
import { COUNTER_FROM, countChars, normalizeBody, POST_MAX } from "@/lib/postInput";
import { browserClient } from "@/lib/supabase-browser";
import type { Author } from "@/lib/types";

/**
 * 글쓰기 — 쓰레드의 작성 화면을 따른다.
 *
 *   · 위에는 취소와 제목만. 게시 버튼은 아래 — 엄지가 닿는 곳이다
 *   · 아바타 옆에서 바로 쓴다. 입력창에 테두리가 없다 — 피드의 글과 같은 모양으로 쓰게 된다
 *   · 글자 수는 50자 남았을 때부터만 보인다
 *   · 쓰다 나가면 임시 저장을 묻는다
 */

const DRAFT_KEY = "tennisscene:draft";

type Draft = { body: string; isAnonymous: boolean };

function readDraft(): Draft {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (raw) return JSON.parse(raw) as Draft;
  } catch {
    // 사파리 개인정보 보호 모드 등. 임시 저장이 없는 것뿐이라 조용히 넘어간다.
  }
  return { body: "", isAnonymous: false };
}

function writeDraft(draft: Draft | null) {
  try {
    if (draft && draft.body.trim()) localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    else localStorage.removeItem(DRAFT_KEY);
  } catch {
    // 위와 같다.
  }
}

/** 익명일 때 아바타 자리에 들어가는 얼굴. 피드에 뜰 모습 그대로다. */
const ANONYMOUS: Author = {
  id: "anonymous",
  name: "익명",
  handle: "anonymous",
  kind: "user",
  initial: "익",
  tone: "neutral",
};

export function Composer({ account }: { account: Author }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [isAnonymous, setAnonymous] = useState(false);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const area = useRef<HTMLTextAreaElement>(null);

  // 임시 저장 복원. localStorage 는 서버에 없어서 마운트 뒤에 읽는다.
  useEffect(() => {
    const draft = readDraft();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 브라우저 저장소에서 한 번 읽어 오는 것이다
    setBody(draft.body);
    setAnonymous(draft.isAnonymous);
    area.current?.focus();
  }, []);

  // 입력창은 내용만큼 자란다. 스크롤바가 생기는 상자 안에서 쓰게 하지 않는다.
  useLayoutEffect(() => {
    const el = area.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [body]);

  const used = countChars(normalizeBody(body));
  const left = POST_MAX - used;
  const canPost = used > 0 && left >= 0 && !posting;
  const face = isAnonymous ? ANONYMOUS : account;

  async function post() {
    if (!canPost) return;
    setPosting(true);
    setError(null);

    try {
      // 토큰은 올리는 순간에 꺼낸다. 한 시간짜리라 오래 쓰다 보면 화면을 열 때 받은 건 죽어 있다.
      // getSession 은 만료가 가까우면 알아서 갱신해 준다.
      const { data } = await browserClient().auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("로그인이 만료됐습니다. 다시 로그인해주세요");

      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ body, isAnonymous }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? "글을 올리지 못했습니다");
      }
      writeDraft(null);
      router.push("/");
      router.refresh(); // 피드는 서버에서 그린다. 방금 쓴 글이 맨 위에 보여야 한다.
    } catch (e) {
      setError(e instanceof Error ? e.message : "글을 올리지 못했습니다");
      setPosting(false);
    }
  }

  function cancel() {
    if (body.trim()) setLeaving(true);
    else router.push("/");
  }

  return (
    <>
      <header className="hair-b sticky top-0 z-10 flex h-(--header-h) shrink-0 items-center justify-between bg-bg/85 px-3 pt-[env(safe-area-inset-top,0px)] backdrop-blur-xl">
        <button type="button" onClick={cancel} className="w-14 cursor-pointer text-left">
          취소
        </button>
        <span className="font-bold">새 글</span>
        <span className="w-14" />
      </header>

      <div className="flex grow gap-2.5 px-3 pt-3 pb-6">
        <Avatar author={face} />
        <div className="min-w-0 grow">
          <p className="font-semibold">{face.name}</p>
          <label htmlFor="body" className="sr-only">
            내용
          </label>
          <textarea
            id="body"
            ref={area}
            rows={1}
            value={body}
            placeholder="오늘 코트에서 무슨 일이 있었나요?"
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") void post();
            }}
            className="block w-full resize-none overflow-hidden bg-transparent outline-none placeholder:text-ink-3"
          />

          <button
            type="button"
            aria-pressed={isAnonymous}
            onClick={() => setAnonymous((v) => !v)}
            className={`mt-3 flex h-[34px] cursor-pointer items-center gap-1.5 rounded-full px-3.5 font-semibold ${
              isAnonymous ? "bg-ink text-bg" : "hair text-ink-3"
            }`}
          >
            <Incognito className="h-[18px] w-[18px]" />
            익명으로
          </button>
        </div>
      </div>

      <footer className="sticky bottom-0 flex shrink-0 items-center gap-3 bg-bg/85 px-3 pt-2 pb-[max(env(safe-area-inset-bottom),12px)] backdrop-blur-xl">
        <p
          role={error ? "alert" : undefined}
          className={`min-w-0 grow text-[13px] leading-[18px] ${error ? "text-down" : "text-ink-3"}`}
        >
          {error ??
            (isAnonymous
              ? "이름은 가려지지만 신고되면 계정에 기록됩니다"
              : "누구나 볼 수 있습니다")}
        </p>

        {left <= COUNTER_FROM && (
          <span className={`num shrink-0 ${left < 0 ? "text-down" : "text-ink-3"}`}>{left}</span>
        )}

        <button
          type="button"
          onClick={() => void post()}
          disabled={!canPost}
          className="h-9 shrink-0 cursor-pointer rounded-full bg-ink px-4 font-semibold text-bg disabled:cursor-default disabled:opacity-30"
        >
          {posting ? "올리는 중" : "게시"}
        </button>
      </footer>

      {leaving && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="임시 저장"
          className="fixed inset-0 z-30 flex items-center justify-center bg-black/50 px-10"
        >
          <div className="w-full max-w-[280px] overflow-hidden rounded-[14px] bg-grouped text-center">
            <p className="px-6 py-5 font-bold">임시 저장할까요?</p>
            <button
              type="button"
              onClick={() => {
                writeDraft({ body, isAnonymous });
                router.push("/");
              }}
              className="hair-t block h-12 w-full cursor-pointer font-bold"
            >
              저장
            </button>
            <button
              type="button"
              onClick={() => {
                writeDraft(null);
                router.push("/");
              }}
              className="hair-t block h-12 w-full cursor-pointer text-down"
            >
              저장 안 함
            </button>
            <button
              type="button"
              onClick={() => setLeaving(false)}
              className="hair-t block h-12 w-full cursor-pointer"
            >
              계속 쓰기
            </button>
          </div>
        </div>
      )}
    </>
  );
}
