"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PostCard } from "@/components/post/PostCard";
import type { FeedPage } from "@/lib/feed";
import type { Post } from "@/lib/types";

/**
 * 시간순 무한 스크롤.
 *
 * 커서는 `created_at` 이다. offset 페이지네이션은 새 글이 들어오면 경계가 밀려
 * 같은 글이 두 번 나오거나 빠진다. 봇이 수시로 올리는 피드에서는 반드시 티가 난다.
 */

/** 바닥에서 이만큼 남았을 때 미리 받는다. 스크롤이 멈추지 않게. */
const PREFETCH_MARGIN = "600px";

export function FeedStream({ initial }: { initial: FeedPage }) {
  const [posts, setPosts] = useState<Post[]>(initial.posts);
  const [cursor, setCursor] = useState<string | null>(initial.nextCursor);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  // 같은 커서로 두 번 요청하지 않게 잠근다.
  const inFlight = useRef<string | null>(null);
  const sentinel = useRef<HTMLDivElement>(null);

  const loadMore = useCallback(async () => {
    if (!cursor || inFlight.current === cursor) return;
    inFlight.current = cursor;
    setLoading(true);
    setFailed(false);

    try {
      const res = await fetch(`/api/feed?cursor=${encodeURIComponent(cursor)}`);
      if (!res.ok) throw new Error(String(res.status));
      const page: FeedPage = await res.json();

      // 서버가 같은 글을 다시 주면 걸러낸다. 중복 key 로 React 가 깨지는 게 더 나쁘다.
      setPosts((prev) => {
        const seen = new Set(prev.map((p) => p.id));
        return [...prev, ...page.posts.filter((p) => !seen.has(p.id))];
      });
      setCursor(page.nextCursor);
    } catch {
      // 커서를 그대로 두고 다시 시도할 수 있게 한다.
      inFlight.current = null;
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [cursor]);

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

  return (
    <div>
      {posts.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}

      <div ref={sentinel} aria-hidden />

      {loading && (
        <p className="py-6 text-center text-[13px] text-ink-3">불러오는 중</p>
      )}

      {failed && (
        <div className="flex flex-col items-center gap-2 py-6">
          <p className="text-[13px] text-ink-3">불러오지 못했습니다</p>
          <button
            type="button"
            onClick={() => void loadMore()}
            className="cursor-pointer rounded-full border border-line px-4 py-1.5 text-[13px] font-medium text-ink"
          >
            다시 시도
          </button>
        </div>
      )}

      {!cursor && !loading && posts.length > 0 && (
        // 끝을 알려준다. 오래된 글을 무한히 되감아 보여주지 않는다.
        <p className="py-8 text-center text-[12.5px] text-muted">여기까지입니다</p>
      )}
    </div>
  );
}
