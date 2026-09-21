"use client";

import { useState } from "react";
import { CaretDown, CaretUp, Chevron } from "@/components/icons";
import type { RankRow } from "@/lib/types";

/**
 * 2위 아래는 접어둔다. 카드 **안에서** 펴진다 — 바깥에 두 번째 상자를 만들지 않는다.
 *
 * 카드의 일은 "이번 주 1위가 누구인지"를 한눈에 알리는 것이다.
 * 기본으로 표를 펼치면 헤드라인이 묻힌다. 더 보고 싶은 사람만 편다.
 */

/**
 * 비교 불가와 신규 진입은 다르다.
 * 첫 주차에 전원을 NEW 로 찍으면 "이번 주 새로 진입"이라는 말이 무의미해진다.
 */
function Delta({ delta, isNew }: { delta: number | null; isNew?: boolean }) {
  if (isNew)
    return <span className="text-[12px] leading-[18px] font-bold text-green">NEW</span>;
  if (delta === null || delta === 0) return null;

  const up = delta > 0;
  return (
    <span className="flex items-center gap-0.5">
      {up ? <CaretUp size={10} /> : <CaretDown size={10} />}
      <span
        className={`num text-[13px] leading-[18px] font-semibold ${up ? "text-green-hi" : "text-down"}`}
      >
        {Math.abs(delta)}
      </span>
    </span>
  );
}

const TOGGLE =
  "hair-t flex h-11 w-full cursor-pointer items-center justify-between px-3 text-[13px] leading-[18px] font-semibold";

export function RankingList({ rows }: { rows: RankRow[] }) {
  const [open, setOpen] = useState(false);
  const first = rows[0]?.rank ?? 2;
  const last = rows.at(-1)?.rank ?? first;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={false}
        className={TOGGLE}
      >
        {first}–{last}위
        <Chevron className="h-3.5 w-3.5 text-ink-3" />
      </button>
    );
  }

  return (
    <>
      {rows.map((r) => (
        <div
          key={`${r.rank}-${r.name}`}
          className="hair-t flex items-center gap-3 px-3 py-2"
        >
          <span className="num w-5 shrink-0 text-center text-ink-3">{r.rank}</span>
          <div className="min-w-0 grow">
            <p className="truncate">{r.name}</p>
            {r.club && (
              <p className="truncate text-[13px] leading-[18px] text-ink-3">{r.club}</p>
            )}
          </div>
          <Delta delta={r.delta} isNew={r.isNew} />
        </div>
      ))}

      <button
        type="button"
        onClick={() => setOpen(false)}
        aria-expanded
        className={`${TOGGLE} text-ink-3`}
      >
        접기
        <Chevron up className="h-3.5 w-3.5" />
      </button>
    </>
  );
}
