"use client";

import { useState } from "react";
import { CaretDown, CaretUp } from "@/components/icons";
import type { RankRow } from "@/lib/types";

/**
 * 2위 아래는 접어둔다.
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
    return (
      <span className="rounded-md bg-green-bg px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-green">
        NEW
      </span>
    );
  if (delta === null || delta === 0)
    return <span className="text-xs text-muted">—</span>;

  const up = delta > 0;
  return (
    <span className="flex items-center gap-1">
      {up ? <CaretUp /> : <CaretDown />}
      <span
        className={`num text-xs font-medium ${up ? "text-green" : "text-[var(--color-down)]"}`}
      >
        {Math.abs(delta)}
      </span>
    </span>
  );
}

export function RankingList({ rows }: { rows: RankRow[] }) {
  const [open, setOpen] = useState(false);
  const last = rows.at(-1)?.rank ?? 1;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={false}
        className="mt-1.5 w-full cursor-pointer rounded-card border border-hairline bg-surface py-2.5 text-[12.5px] font-medium text-green"
      >
        {last}위까지 보기
      </button>
    );
  }

  return (
    <div className="mt-1.5 overflow-hidden rounded-card border border-hairline bg-surface">
      {rows.map((r, i) => (
        <div key={`${r.rank}-${r.name}`}>
          {i > 0 && <div className="ml-[42px] h-px bg-hairline" />}
          <div className="flex items-center gap-3 px-3.5 py-2.5">
            <span className="num w-[18px] text-right text-[13px] font-semibold text-ink-2">
              {r.rank}
            </span>
            <div className="min-w-0 grow">
              <p className="truncate text-[13.5px] font-medium tracking-[-0.01em]">
                {r.name}
              </p>
              {r.club && (
                <p className="truncate text-[11px] text-ink-3">{r.club}</p>
              )}
            </div>
            <Delta delta={r.delta} isNew={r.isNew} />
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={() => setOpen(false)}
        aria-expanded
        className="w-full cursor-pointer border-t border-hairline py-2.5 text-[12.5px] font-medium text-ink-3"
      >
        접기
      </button>
    </div>
  );
}
