import { AvatarGlyph, Verified } from "@/components/icons";
import { Avatar } from "./Avatar";
import { Attachment } from "./Attachment";
import { PostActions } from "./PostActions";
import type { Post, Quote } from "@/lib/types";

function QuoteCard({ q }: { q: Quote }) {
  return (
    <div className="mt-0.5 rounded-card border border-hairline bg-surface px-3.5 py-3">
      <div className="flex items-center gap-1.5">
        <span className="w-[18px] h-[18px] rounded-full bg-green-bg text-green flex items-center justify-center">
          {q.icon && <AvatarGlyph name={q.icon} className="w-2.5 h-2.5" />}
        </span>
        <span className="text-[12.5px] font-semibold">{q.authorName}</span>
        <span className="text-[11.5px] text-[#77877f]">@{q.authorHandle}</span>
      </div>
      <p className="mt-1.5 text-[13px] leading-[1.5] text-ink-2">{q.summary}</p>
    </div>
  );
}

/**
 * 봇·브랜드·유저가 전부 같은 틀을 쓴다.
 * 구분은 이름 옆 배지 하나뿐이다.
 */
export function PostCard({ post }: { post: Post }) {
  return (
    <article className="flex gap-3 px-5 py-4 border-b border-hairline">
      <Avatar author={post.author} />

      <div className="grow min-w-0 flex flex-col gap-[7px]">
        <div className="flex items-center gap-1.5">
          <span className="text-[14.5px] font-semibold tracking-[-0.01em]">
            {post.author.name}
          </span>
          {post.author.kind !== "user" && <Verified />}
          <span className="text-[12.5px] text-ink-3">
            @{post.author.handle} · {post.timeLabel}
          </span>
        </div>

        {post.body && (
          <p className="text-[15px] leading-[1.6] tracking-[-0.005em]">{post.body}</p>
        )}

        {post.attachment && <Attachment a={post.attachment} />}
        {post.quote && <QuoteCard q={post.quote} />}

        <PostActions stats={post.stats} liked={post.liked} />
      </div>
    </article>
  );
}
