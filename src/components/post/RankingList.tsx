"use client";

import { useState } from "react";
import { CaretDown, CaretUp } from "@/components/icons";
import type { RankRow } from "@/lib/types";

/** 기본으로 보여주는 인원. 나머지는 접어둔다. */
const PREVIEW = 3;

/**
 * 비교 불가와 신규 진입은 다르다.
 * 첫 주차에 전원을 NEW 로 찍으면 "이번 주 새로 진입"이라는 말이 무의미해진다.
 */
function Delta({ delta, isNew }: { delta: number | null; isNew?: boolean }) {
  if (isNew)
    return (
      <span className="text-[10px] font-semibold tracking-wide text-green bg-green-bg rounded-md px-1.5 py-0.5">
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
  const shown = open ? rows : rows.slice(0, PREVIEW);
  const hidden = rows.length - PREVIEW;

  return (
    <div className="mt-0.5 rounded-card border border-hairline bg-surface overflow-hidden">
      {shown.map((r, i) => (
        <div key={r.rank + r.name}>
          {i > 0 && <div className="h-px ml-[42px] bg-hairline" />}
          <div className="flex items-center gap-3 px-3.5 py-2.5">
            <span className="num w-[18px] text-right text-[13px] font-semibold text-ink-2">
              {r.rank}
            </span>
            <div className="grow min-w-0">
              <p className="text-[13.5px] font-medium tracking-[-0.01em] truncate">
                {r.name}
              </p>
              {r.club && (
                <p className="text-[11px] text-ink-3 truncate">{r.club}</p>
              )}
            </div>
            <Delta delta={r.delta} isNew={r.isNew} />
          </div>
        </div>
      ))}

      {hidden > 0 && (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="w-full border-t border-hairline py-2.5 text-[12.5px] font-medium text-green cursor-pointer"
        >
          {open ? "접기" : `${rows.length + 1}위까지 보기`}
        </button>
      )}
    </div>
  );
}
