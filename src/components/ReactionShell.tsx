"use client";

import { useCallback, useState } from "react";
import { LoginSheet } from "@/components/LoginSheet";
import { ReactionProvider, useReactions } from "@/lib/reactions";

/**
 * 반응 상태를 앱 전체에 깔고, 비회원이 반응을 누르면 로그인 시트를 띄운다.
 * 시트는 한 곳에만 있어야 한다 — 포스트마다 두면 화면에 수십 개가 깔린다.
 */
function Bridge({ children }: { children: React.ReactNode }) {
  const { onNeedsLogin } = useReactions();
  const [open, setOpen] = useState(false);

  // 반응 쪽에서 "로그인이 필요하다"고 알려오면 시트를 연다.
  onNeedsLogin(useCallback(() => setOpen(true), []));

  return (
    <>
      {children}
      <LoginSheet open={open} onClose={() => setOpen(false)} />
    </>
  );
}

export function ReactionShell({ children }: { children: React.ReactNode }) {
  return (
    <ReactionProvider>
      <Bridge>{children}</Bridge>
    </ReactionProvider>
  );
}
