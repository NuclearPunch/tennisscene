"use client";

import { useEffect } from "react";
import { AuthGate } from "@/components/AuthGate";
import { Close } from "@/components/icons";
import { useMe } from "@/lib/me";

/**
 * 반응을 누르려는데 로그인이 안 돼 있을 때 올라오는 시트.
 *
 * 읽기에는 로그인이 없다(CLAUDE.md). 그래서 문은 **쓰려고 할 때만** 나온다.
 * 로그인이 끝나면 저절로 닫힌다 — 누르던 흐름으로 바로 돌아가야 한다.
 */
export function LoginSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { me, refresh } = useMe();
  const ready = me.status === "ready";

  useEffect(() => {
    if (open && ready) onClose();
  }, [open, ready, onClose]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || ready) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="로그인"
      className="fixed inset-0 z-30 flex items-end justify-center bg-black/50"
      onClick={onClose}
    >
      {/* 시트 안을 눌렀다고 닫히면 안 된다. */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[88dvh] w-full max-w-[520px] flex-col overflow-y-auto rounded-t-[20px] bg-bg pb-[max(env(safe-area-inset-bottom),16px)]"
      >
        <div className="flex h-12 shrink-0 items-center justify-end px-2">
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="flex h-10 w-10 cursor-pointer items-center justify-center text-ink-3"
          >
            <Close className="h-4 w-4" />
          </button>
        </div>
        <AuthGate me={me} refresh={refresh}>
          {null}
        </AuthGate>
      </div>
    </div>
  );
}
