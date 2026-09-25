import Link from "next/link";
import { SearchBox } from "@/components/SearchBox";
import { PostCard } from "@/components/post/PostCard";
import { FEED_TAGS, SEARCH_MIN, searchPosts } from "@/lib/feed";

export const dynamic = "force-dynamic";

/**
 * 검색 (F-4.1).
 *
 * **검색어는 주소에 산다**(`/search?q=성남배`). 링크로 보낼 수 있고 뒤로가기가 통한다.
 * 결과는 피드와 **같은 포스트 카드**로 그린다 — 검색 전용 표를 만들면
 * 같은 글이 두 모양으로 존재하게 된다(CLAUDE.md 규칙 2).
 */
export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const term = q.trim();
  const posts = term.length >= SEARCH_MIN ? await searchPosts(term).catch(() => []) : [];

  return (
    <div>
      <SearchBox initial={term} />

      {term.length < SEARCH_MIN ? (
        <div className="px-3 py-8">
          <p className="text-ink-3">
            대회 이름, 선수 이름, 영상 제목으로 찾습니다. 두 글자부터요.
          </p>
          <p className="mt-6 mb-2 font-semibold">종류별로 모아 보기</p>
          <div className="flex flex-wrap gap-1.5">
            {FEED_TAGS.map((t) => (
              <Link
                key={t.slug}
                href={`/?tag=${t.slug}`}
                className="hair flex h-[34px] items-center rounded-full px-3.5 font-semibold"
              >
                #{t.label}
              </Link>
            ))}
          </div>
        </div>
      ) : posts.length === 0 ? (
        <p className="px-3 py-10 text-center text-ink-3">
          &lsquo;{term}&rsquo; 로 찾은 글이 없습니다
        </p>
      ) : (
        <>
          <p className="px-3 pt-1 pb-3 text-[13px] leading-[18px] text-ink-3">
            {posts.length}건
          </p>
          {posts.map((p) => (
            <PostCard key={p.id} post={p} />
          ))}
        </>
      )}
    </div>
  );
}
