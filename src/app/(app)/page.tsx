import { FeedStream } from "@/components/FeedStream";
import { findFeedTag, loadFeed } from "@/lib/feed";

// 수집 잡이 새 포스트를 올리므로 매 요청마다 읽는다.
export const dynamic = "force-dynamic";

/**
 * 시간순 단일 피드.
 *
 * **걸린 해시태그는 주소에 산다**(`/?tag=result`). 화면 안에만 두면
 * 링크로 보낼 수도, 뒤로가기로 돌아갈 수도, 홈 화면 바로가기로 열 수도 없다.
 * 매니페스트의 "대회 결과" 바로가기가 바로 이 주소를 연다.
 */
export default async function FeedPage({
  searchParams,
}: {
  searchParams: Promise<{ tag?: string }>;
}) {
  const { tag } = await searchParams;
  // 모르는 slug 는 없는 셈 친다. 오타 난 주소로 빈 화면을 주지 않는다.
  const active = findFeedTag(tag)?.slug ?? null;
  const initial = await loadFeed(undefined, active);

  return (
    // 태그가 바뀌면 목록을 처음부터 다시 그린다. 이전 태그의 글이 남아 있으면 안 된다.
    <FeedStream key={active ?? "all"} initial={initial} tag={active} />
  );
}
