"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ComposePrompt } from "@/components/ComposePrompt";
import { InstallHint } from "@/components/InstallHint";
import { PostCard } from "@/components/post/PostCard";
import { TagBar } from "@/components/TagBar";
import { FEED_TAGS, type FeedPage } from "@/lib/feed";
import { useReactions } from "@/lib/reactions";
import type { Post } from "@/lib/types";

/**
 * 시간순 무한 스크롤 + 해시태그 모아보기.
 *
 * 커서는 `created_at` 이다. offset 페이지네이션은 새 글이 들어오면 경계가 밀려
 * 같은 글이 두 번 나오거나 빠진다. 봇이 수시로 올리는 피드에서는 반드시 티가 난다.
 *
 * 태그는 거르기만 한다. 순서는 걸려 있든 아니든 시간순 그대로다.
 */

/** 바닥에서 이만큼 남았을 때 미리 받는다. 스크롤이 멈추지 않게. */
const PREFETCH_MARGIN = "600px";

async function fetchPage(
  cursor: string | null,
  tag: string | null,
): Promise<FeedPage> {
  const q = new URLSearchParams();
  if (cursor) q.set("cursor", cursor);
  if (tag) q.set("tag", tag);
  const res = await fetch(`/api/feed?${q}`);
  if (!res.ok) throw new Error(String(res.status));
  return res.json();
}

export function FeedStream({ initial }: { initial: FeedPage }) {
  const [tag, setTag] = useState<string | null>(null);
  const [posts, setPosts] = useState<Post[]>(initial.posts);
  const [cursor, setCursor] = useState<string | null>(initial.nextCursor);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  // 같은 커서로 두 번 요청하지 않게 잠근다.
  const inFlight = useRef<string | null>(null);
  /**
   * 태그를 바꿀 때마다 올린다. 앞서 나간 요청이 늦게 도착해서
   * 지금 걸린 태그의 목록을 덮어쓰는 걸 막는다 — 칩을 빠르게 두 번 누르면 난다.
   */
  const reqId = useRef(0);
  const sentinel = useRef<HTMLDivElement>(null);
  const { hydrate } = useReactions();

  const loadMore = useCallback(async () => {
    if (!cursor || inFlight.current === cursor) return;
    const id = reqId.current;
    inFlight.current = cursor;
    setLoading(true);
    setFailed(false);

    try {
      const page = await fetchPage(cursor, tag);
      if (reqId.current !== id) return; // 그 사이 태그가 바뀌었다. 이 결과는 버린다.

      // 서버가 같은 글을 다시 주면 걸러낸다. 중복 key 로 React 가 깨지는 게 더 나쁘다.
      setPosts((prev) => {
        const seen = new Set(prev.map((p) => p.id));
        return [...prev, ...page.posts.filter((p) => !seen.has(p.id))];
      });
      setCursor(page.nextCursor);
    } catch {
      if (reqId.current !== id) return;
      // 커서를 그대로 두고 다시 시도할 수 있게 한다.
      inFlight.current = null;
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [cursor, tag]);

  const changeTag = useCallback(
    async (next: string | null) => {
      const id = ++reqId.current;
      inFlight.current = null;
      setTag(next);
      // 먼저 비운다. #대회결과 를 눌렀는데 랭킹 글이 잠깐 남아 있으면 안 눌린 것처럼 보인다.
      setPosts([]);
      setCursor(null);
      setLoading(true);
      setFailed(false);

      try {
        const page = await fetchPage(null, next);
        if (reqId.current !== id) return;
        setPosts(page.posts);
        setCursor(page.nextCursor);
        window.scrollTo({ top: 0 });
      } catch {
        if (reqId.current !== id) return;
        setFailed(true);
      } finally {
        if (reqId.current === id) setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    const el = sentinel.current;
    if (!el || !cursor || failed) return;

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) void loadMore();
      },
      { rootMargin: PREFETCH_MARGIN },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [cursor, failed, loadMore]);

  // 새로 들어온 글들에 대해 "내가 반응한 게 뭐냐"를 채운다. 이미 물어본 건 건너뛴다.
  useEffect(() => {
    if (posts.length > 0) void hydrate(posts.map((p) => p.id));
  }, [posts, hydrate]);

  const label = FEED_TAGS.find((t) => t.slug === tag)?.label;
  const empty = !loading && !failed && posts.length === 0;

  return (
    <div>
      <InstallHint />
      <ComposePrompt />
      <TagBar active={tag} onChange={(next) => void changeTag(next)} />

      {posts.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}

      <div ref={sentinel} aria-hidden />

      {empty && (
        <div className="flex flex-col items-center gap-3 px-8 py-20 text-center">
          <p className="text-ink-3">
            {label ? `#${label} 로 모인 글이 아직 없습니다` : "올라온 글이 없습니다"}
          </p>
          {tag && (
            <button
              type="button"
              onClick={() => void changeTag(null)}
              className="hair h-[34px] cursor-pointer rounded-full px-4 font-semibold"
            >
              전체 보기
            </button>
          )}
        </div>
      )}

      {loading && (
        <p className="py-6 text-center text-ink-3">불러오는 중</p>
      )}

      {failed && (
        <div className="flex flex-col items-center gap-3 py-6">
          <p className="text-ink-3">불러오지 못했습니다</p>
          <button
            type="button"
            onClick={() => void (posts.length === 0 ? changeTag(tag) : loadMore())}
            className="hair h-[34px] cursor-pointer rounded-full px-4 font-semibold"
          >
            다시 시도
          </button>
        </div>
      )}

      {!cursor && !loading && posts.length > 0 && (
        // 끝을 알려준다. 오래된 글을 무한히 되감아 보여주지 않는다.
        <p className="py-8 text-center text-[13px] leading-[18px] text-muted">여기까지입니다</p>
      )}
    </div>
  );
}
