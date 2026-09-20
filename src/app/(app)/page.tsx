import { FeedStream } from "@/components/FeedStream";
import { loadFeed } from "@/lib/feed";

// 수집 잡이 새 포스트를 올리므로 매 요청마다 읽는다.
export const dynamic = "force-dynamic";

export default async function FeedPage() {
  const initial = await loadFeed();

  if (initial.posts.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 px-8 py-24 text-center">
        <p className="text-[17px] font-semibold tracking-[-0.02em]">
          아직 올라온 글이 없습니다
        </p>
        <p className="max-w-[260px] text-[13px] leading-[1.6] text-ink-3">
          월요일 아침에 주간 랭킹이 올라옵니다.
        </p>
      </div>
    );
  }

  return <FeedStream initial={initial} />;
}
