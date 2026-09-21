"use client";

import { Close } from "@/components/icons";
import { FEED_TAGS } from "@/lib/feed";

/**
 * 해시태그 모아보기 바.
 *
 * **탭바가 아니다.** 기본으로 눌린 칩이 없다 — "전체" 칩을 두면 그 순간
 * 콘텐츠 탭이 되고, 그건 이 앱이 안 하기로 한 것이다(CLAUDE.md 규칙 1).
 * 걸린 칩은 ✕ 를 달아서 "다시 누르면 풀린다"를 보이게 한다. 안 그러면
 * 한 번 누른 사람이 전체 피드로 못 돌아온다고 느낀다.
 */
export function TagBar({
  active,
  onChange,
}: {
  active: string | null;
  onChange: (slug: string | null) => void;
}) {
  return (
    <div
      role="group"
      aria-label="해시태그 모아보기"
      className="hair-b sticky top-(--header-h) z-10 bg-bg/85 backdrop-blur-xl"
    >
      {/* 태그가 늘어나면 가로로 넘친다. 줄바꿈하면 헤더 높이가 들쭉날쭉해진다. */}
      <div className="no-scrollbar flex gap-1.5 overflow-x-auto px-3 py-2.5">
        {FEED_TAGS.map((t) => {
          const on = t.slug === active;
          return (
            <button
              key={t.slug}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(on ? null : t.slug)}
              className={`flex h-[34px] shrink-0 cursor-pointer items-center gap-1 rounded-full px-3.5 font-semibold ${
                on ? "bg-ink text-bg" : "hair text-ink"
              }`}
            >
              #{t.label}
              {on && <Close className="-mr-0.5 h-3.5 w-3.5" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
