import { AvatarGlyph, Verified } from "@/components/icons";
import { Avatar } from "./Avatar";
import { Attachment } from "./Attachment";
import { PostActions } from "./PostActions";
import type { Post, Quote } from "@/lib/types";

function QuoteCard({ q }: { q: Quote }) {
  return (
    <div className="hair mt-2 rounded-card px-3 py-2.5">
      <div className="flex items-center gap-1.5">
        <span className="flex h-[18px] w-[18px] items-center justify-center rounded-full bg-green-deep text-ball">
          {q.icon && <AvatarGlyph name={q.icon} className="h-2.5 w-2.5" />}
        </span>
        <span className="font-semibold">{q.authorName}</span>
      </div>
      <p className="mt-1 text-ink-2">{q.summary}</p>
    </div>
  );
}

/**
 * 봇·브랜드·유저가 전부 같은 틀을 쓴다. 구분은 이름 옆 배지 하나뿐이다.
 *
 * 이름·시간·본문이 전부 같은 크기(15)다. 굵기와 색으로만 가른다.
 * 핸들은 머리줄에 넣지 않는다 — 이름 옆에 @아이디까지 달면 한 줄에 정보가 셋이라
 * 눈이 시간을 못 찾는다. 핸들은 프로필에서 본다.
 */
export function PostCard({ post }: { post: Post }) {
  return (
    <article className="hair-b flex gap-2.5 px-3 pt-3 pb-1">
      <Avatar author={post.author} />

      <div className="min-w-0 grow">
        <div className="flex items-center gap-1.5">
          <span className="truncate font-semibold">{post.author.name}</span>
          {post.author.kind !== "user" && <Verified />}
          <span className="shrink-0 text-ink-3">{post.timeLabel}</span>
        </div>

        {post.body && <p className="whitespace-pre-line">{post.body}</p>}

        {post.attachment && <Attachment a={post.attachment} />}
        {post.quote && <QuoteCard q={post.quote} />}

        <PostActions id={post.id} stats={post.stats} />
      </div>
    </article>
  );
}
