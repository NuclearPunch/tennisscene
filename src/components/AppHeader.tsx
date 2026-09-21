import { Logo } from "@/components/Logo";

/** 쓰레드처럼 로고를 가운데에 건다. 색이 없는 로고라 라이트·다크를 글자색으로 따라간다. */
export function AppHeader() {
  return (
    <header className="sticky top-0 z-20 flex h-(--header-h) items-center justify-center bg-bg/85 pt-[env(safe-area-inset-top,0px)] backdrop-blur-xl">
      <h1 className="flex text-ink">
        <Logo height={26} />
      </h1>
    </header>
  );
}
