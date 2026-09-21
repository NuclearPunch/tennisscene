import { notFound } from "next/navigation";
import { CommentComposer } from "@/components/post/CommentComposer";
import { HydrateReactions } from "@/components/HydrateReactions";
import { PostCard } from "@/components/post/PostCard";
import { loadThread } from "@/lib/feed";

// 댓글이 바로 보여야 하므로 캐시하지 않는다.
export const dynamic = "force-dynamic";

/**
 * 포스트 하나와 그 댓글 — F-3.7
 *
 * 봇 글에도 댓글이 달린다. 봇과 유저가 같은 포스트 템플릿을 쓰기 때문에(CLAUDE.md 규칙 2)
 * 이 화면은 둘을 구분하지 않는다.
 */
export default async function ThreadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const thread = await loadThread(id).catch(() => null);
  if (!thread) notFound();

  return (
    <div>
      <HydrateReactions ids={[thread.post.id, ...thread.comments.map((c) => c.id)]} />
      <PostCard post={thread.post} />
      <CommentComposer postId={id} />

      {thread.comments.map((c) => (
        <PostCard key={c.id} post={c} />
      ))}

      {thread.comments.length === 0 && (
        <p className="px-4 py-10 text-center text-ink-3">
          첫 번째 댓글을 남겨보세요
        </p>
      )}
    </div>
  );
}
