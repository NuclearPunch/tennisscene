"use client";

import { useState } from "react";
import { LegalLinks } from "@/components/AuthGate";
import { useModeration } from "@/lib/moderationClient";
import { browserClient } from "@/lib/supabase-browser";

/**
 * 프로필 아래 — 차단한 계정, 탈퇴.
 *
 * 탈퇴는 앱 안에서 바로 된다(애플 5.1.1(v)). 되돌릴 수 없으니 무엇이 지워지는지 먼저 보여주고
 * 한 번 더 누르게 한다. 지우는 일은 DB 함수(delete_my_account)가 한다 — 로그인 정보까지.
 */
export function AccountSettings() {
  const { blocked, unblock } = useModeration();
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gone, setGone] = useState(false);

  async function leave() {
    setBusy(true);
    setError(null);
    const { error } = await browserClient().rpc("delete_my_account");
    if (error) {
      setBusy(false);
      return setError("탈퇴하지 못했습니다. 잠시 뒤 다시 시도해주세요");
    }
    setGone(true);
    // 로그인 정보가 지워졌으니 이 기기의 세션도 버린다.
    await browserClient().auth.signOut().catch(() => {});
  }

  if (gone) return <p className="hair-t px-3 py-6 text-ink-3">탈퇴했습니다. 그동안 함께해 주셔서 고맙습니다.</p>;

  return (
    <>
      <section className="hair-t pt-4">
        <h2 className="px-3 pb-1 font-semibold">차단한 계정</h2>
        {blocked.length === 0 ? (
          <p className="px-3 pb-4 text-[13px] leading-[18px] text-ink-3">
            없습니다. 글의 ··· 메뉴에서 차단하면 그 사람의 글과 댓글이 내 화면에서 사라집니다.
          </p>
        ) : (
          <ul>
            {blocked.map((b) => (
              <li key={b.handle} className="flex items-center gap-3 px-3 py-2">
                <div className="min-w-0 grow">
                  <p className="truncate">{b.name}</p>
                  <p className="truncate text-[13px] leading-[18px] text-ink-3">@{b.handle}</p>
                </div>
                <button
                  type="button"
                  onClick={() => void unblock(b.handle)}
                  className="hair h-[34px] shrink-0 cursor-pointer rounded-full px-3.5 font-semibold"
                >
                  차단 해제
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="hair-t px-3 py-4">
        <LegalLinks />
      </section>

      <section className="hair-t px-3 py-4">
        {!asking ? (
          <button type="button" onClick={() => setAsking(true)} className="cursor-pointer text-down">
            탈퇴하기
          </button>
        ) : (
          <div>
            <p className="font-semibold">정말 탈퇴할까요?</p>
            <ul className="mt-1 list-disc pl-5 text-ink-3">
              <li>로그인 정보(이메일·비밀번호)가 지워집니다</li>
              <li>쓴 글과 댓글이 모두 내려갑니다</li>
              <li>좋아요·리포스트·차단 목록이 지워집니다</li>
              <li>되돌릴 수 없습니다. 같은 이메일로 다시 가입할 수는 있습니다</li>
            </ul>
            {error && <p className="mt-2 text-[13px] leading-[18px] text-down">{error}</p>}
            <div className="mt-3 flex gap-2">
              <button type="button" onClick={() => setAsking(false)} className="hair h-11 grow cursor-pointer rounded-card font-semibold">
                취소
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void leave()}
                className="h-11 grow cursor-pointer rounded-card bg-down font-semibold text-white disabled:opacity-40"
              >
                {busy ? "지우는 중" : "탈퇴"}
              </button>
            </div>
          </div>
        )}
      </section>
    </>
  );
}
