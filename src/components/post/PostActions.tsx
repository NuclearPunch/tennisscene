"use client";

import { useState } from "react";
import { Heart, Reply, Repost } from "@/components/icons";
import type { PostStats } from "@/lib/types";

export function PostActions({
  stats,
  liked = false,
}: {
  stats: PostStats;
  liked?: boolean;
}) {
  const [on, setOn] = useState(liked);
  const likes = stats.likes + (on === liked ? 0 : on ? 1 : -1);

  return (
    <div className="mt-1.5 flex items-center gap-[22px] text-[#77877f]">
      <button
        type="button"
        aria-label={`댓글 ${stats.replies}개`}
        className="flex items-center gap-1.5 cursor-pointer"
      >
        <Reply className="w-[18px] h-[18px]" />
        <span className="num text-[12.5px]">{stats.replies}</span>
      </button>

      <button
        type="button"
        aria-label={`리포스트 ${stats.reposts}개`}
        className="flex items-center gap-1.5 cursor-pointer"
      >
        <Repost className="w-[18px] h-[18px]" />
        <span className="num text-[12.5px]">{stats.reposts}</span>
      </button>

      <button
        type="button"
        aria-pressed={on}
        aria-label={on ? "좋아요 취소" : "좋아요"}
        onClick={() => setOn((v) => !v)}
        className={`flex items-center gap-1.5 cursor-pointer ${on ? "text-green" : ""}`}
      >
        <Heart filled={on} className="w-[18px] h-[18px]" />
        <span className="num text-[12.5px]">{likes}</span>
      </button>
    </div>
  );
}
