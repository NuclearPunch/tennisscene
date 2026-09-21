"use client";

import { useRouter } from "next/navigation";
import { Heart, Reply, Repost, Share } from "@/components/icons";
import { useReactions } from "@/lib/reactions";
import type { PostStats } from "@/lib/types";

/**
 * 0 은 안 쓴다. 새 글마다 "0 0 0" 이 붙어 있으면 조용한 서비스라는 걸 광고하는 셈이다.
 * 숫자는 생겼을 때만 나온다.
 */
function Count({ n }: { n: number }) {
  if (n <= 0) return null;
  return <span className="num text-ink-3">{n}</span>;
}

/** 터치 영역은 40px, 아이콘은 22px. 첫 아이콘이 본문 왼쪽 선에 맞도록 줄 전체를 8px 당긴다. */
const BTN = "flex h-10 cursor-pointer items-center gap-1.5 px-2";

export function PostActions({ id, stats }: { id: string; stats: PostStats }) {
  const router = useRouter();
  const { on, delta, toggle } = useReactions();

  const liked = on("like", id);
  const reposted = on("repost", id);

  return (
    <div className="-ml-2 mt-0.5 flex items-center gap-3 text-ink-2">
      <button
        type="button"
        aria-pressed={liked}
        aria-label={liked ? "좋아요 취소" : "좋아요"}
        onClick={() => toggle("like", id)}
        className={`${BTN} ${liked ? "text-green" : ""}`}
      >
        <Heart filled={liked} className="h-[22px] w-[22px]" />
        <Count n={stats.likes + delta("like", id)} />
      </button>

      <button
        type="button"
        aria-label={`댓글 ${stats.replies}개`}
        onClick={() => router.push(`/p/${id}`)}
        className={BTN}
      >
        <Reply className="h-[22px] w-[22px]" />
        <Count n={stats.replies} />
      </button>

      <button
        type="button"
        aria-pressed={reposted}
        aria-label={reposted ? "리포스트 취소" : "리포스트"}
        onClick={() => toggle("repost", id)}
        className={`${BTN} ${reposted ? "text-green" : ""}`}
      >
        <Repost className="h-[22px] w-[22px]" />
        <Count n={stats.reposts + delta("repost", id)} />
      </button>

      <button
        type="button"
        aria-label="공유"
        onClick={() => {
          const url = `${window.location.origin}/p/${id}`;
          // 모바일은 기본 공유 시트, 데스크톱은 주소 복사로 떨어진다.
          if (navigator.share) void navigator.share({ url }).catch(() => {});
          else void navigator.clipboard?.writeText(url).catch(() => {});
        }}
        className={BTN}
      >
        <Share className="h-[22px] w-[22px]" />
      </button>
    </div>
  );
}
