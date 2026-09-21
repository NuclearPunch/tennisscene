"use client";

import { useEffect, useState } from "react";
import { Close } from "@/components/icons";
import { Mark } from "@/components/Logo";

/**
 * "홈 화면에 추가" 안내.
 *
 * 설치 방법이 기기마다 다르다:
 *   · 안드로이드 크롬 — beforeinstallprompt 를 잡아뒀다가 우리가 원할 때 띄운다
 *   · iOS 사파리     — 그런 이벤트가 없다. 공유 버튼을 거치는 수밖에 없어서 말로 알려준다
 *
 * 이미 설치했으면 안 보인다. 한 번 닫으면 다시 안 띄운다 —
 * 매번 뜨는 설치 배너만큼 앱을 싸구려로 보이게 하는 것도 없다.
 */

const DISMISSED = "tennisscene:install-dismissed";

/** 크롬이 "설치할 수 있다"고 알려줄 때 주는 이벤트. 표준에는 아직 없다. */
type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS 사파리는 display-mode 대신 이걸 쓴다.
    (navigator as { standalone?: boolean }).standalone === true
  );
}

/** iOS 사파리인가. 크롬·파이어폭스의 iOS 판은 홈 화면 추가를 못 한다. */
function isIosSafari(): boolean {
  const ua = navigator.userAgent;
  const ios = /iPad|iPhone|iPod/.test(ua) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(ua));
  return ios && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
}

/** 안 보임 / iOS 안내 / 크롬 설치 버튼 — 셋 중 하나다. */
type Hint = { kind: "hidden" } | { kind: "ios" } | { kind: "prompt"; event: InstallEvent };

export function InstallHint() {
  // 서버에는 navigator 가 없어서 첫 렌더에서는 알 수 없다. 마운트 뒤에 한 번 정한다.
  const [hint, setHint] = useState<Hint>({ kind: "hidden" });

  useEffect(() => {
    try {
      if (localStorage.getItem(DISMISSED)) return;
    } catch {
      // 저장소를 못 읽는 브라우저(사생활 보호 모드). 안내만 못 기억할 뿐이다.
    }
    if (isStandalone()) return;

    if (isIosSafari()) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 서버에 없는 navigator 를 마운트 뒤 한 번 읽는 것이다
      setHint({ kind: "ios" });
      return;
    }

    const onPrompt = (e: Event) => {
      e.preventDefault(); // 크롬이 제 배너를 띄우지 않게 막고 우리가 자리를 정한다
      setHint({ kind: "prompt", event: e as InstallEvent });
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  function close() {
    setHint({ kind: "hidden" });
    try {
      localStorage.setItem(DISMISSED, "1");
    } catch {
      // 위와 같다.
    }
  }

  if (hint.kind === "hidden") return null;
  const ios = hint.kind === "ios";

  return (
    <div className="hair-b flex items-center gap-3 px-3 py-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-ink text-bg">
        <Mark size={22} />
      </span>
      <div className="min-w-0 grow">
        <p className="font-semibold">홈 화면에 추가</p>
        <p className="text-ink-3">
          {ios ? "공유 버튼을 누르고 '홈 화면에 추가'를 고르세요" : "앱처럼 바로 열 수 있어요"}
        </p>
      </div>

      {!ios && (
        <button
          type="button"
          onClick={async () => {
            if (hint.kind !== "prompt") return;
            await hint.event.prompt();
            // 설치했든 취소했든 이 이벤트는 한 번만 쓸 수 있다. 안내를 닫고 기억한다.
            await hint.event.userChoice;
            close();
          }}
          className="h-[34px] shrink-0 cursor-pointer rounded-full bg-ink px-4 font-semibold text-bg"
        >
          추가
        </button>
      )}

      <button
        type="button"
        onClick={close}
        aria-label="닫기"
        className="-mr-1 flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center text-ink-3"
      >
        <Close className="h-4 w-4" />
      </button>
    </div>
  );
}
