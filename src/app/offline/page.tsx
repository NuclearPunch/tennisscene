"use client";

import { Logo } from "@/components/Logo";

/**
 * 인터넷이 끊겼을 때 서비스 워커가 대신 띄우는 화면.
 * 피드는 서버에서 그리므로 오프라인에서 보여줄 내용이 없다. 솔직하게 그렇게 말한다.
 *
 * "다시 시도"는 통째로 다시 불러온다. `<Link>` 로 하면 앱 안에서만 움직여서
 * 서비스 워커가 네트워크를 다시 짚어볼 기회가 없다.
 */
export default function OfflinePage() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[520px] flex-col items-center justify-center gap-5 px-8 text-center">
      <span className="text-ink-3">
        <Logo height={26} />
      </span>
      <div>
        <p className="font-bold">인터넷에 연결되어 있지 않습니다</p>
        <p className="mt-1 text-ink-3">연결되면 피드가 다시 뜹니다.</p>
      </div>
      <button
        type="button"
        onClick={() => window.location.replace("/")}
        className="hair h-[34px] cursor-pointer rounded-full px-4 font-semibold"
      >
        다시 시도
      </button>
    </div>
  );
}
