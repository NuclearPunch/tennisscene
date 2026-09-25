"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Close, TabSearch } from "@/components/icons";

/**
 * 검색 입력칸.
 *
 * **칠 때마다 찾지 않는다.** 한 글자마다 서버를 두드리면 한글은 조합 중에도 이벤트가
 * 튀어서(ㄱ → 가 → 강) 쓸모없는 질의가 쏟아진다. 엔터를 누를 때 주소를 바꾼다.
 */
export function SearchBox({ initial }: { initial: string }) {
  const router = useRouter();
  const [value, setValue] = useState(initial);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const q = value.trim();
    router.push(q ? `/search?q=${encodeURIComponent(q)}` : "/search");
  }

  return (
    <form onSubmit={submit} className="hair-b px-3 py-2.5">
      <div className="flex h-11 items-center gap-2 rounded-full bg-grouped px-3.5">
        <TabSearch className="h-[18px] w-[18px] shrink-0 text-ink-3" />
        <input
          type="search"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="대회·선수·소속 검색"
          aria-label="검색어"
          // 브라우저 기본 지우기 버튼은 모양이 제각각이라 숨기고 우리 것을 쓴다.
          className="min-w-0 grow bg-transparent outline-none placeholder:text-ink-3 [&::-webkit-search-cancel-button]:hidden"
        />
        {value && (
          <button
            type="button"
            aria-label="지우기"
            onClick={() => {
              setValue("");
              router.push("/search");
            }}
            className="-mr-1 flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center text-ink-3"
          >
            <Close className="h-4 w-4" />
          </button>
        )}
      </div>
    </form>
  );
}
