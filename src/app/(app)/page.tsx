import { PostCard } from "@/components/post/PostCard";
import { FEED } from "@/lib/mock";

export default function FeedPage() {
  return (
    <div>
      {FEED.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}
    </div>
  );
}
