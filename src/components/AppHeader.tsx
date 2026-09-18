import { BallMark } from "@/components/icons";

/** 쓰레드처럼 로고만 가운데. 알림은 활동 탭으로 간다. */
export function AppHeader() {
  return (
    <header className="sticky top-0 z-10 flex h-[54px] items-center justify-center border-b border-hairline bg-bg/95 px-5 backdrop-blur">
      <span className="flex items-center gap-[7px]">
        <BallMark size={20} />
        <span className="text-[17px] font-bold tracking-[-0.035em]">테니스씬</span>
      </span>
    </header>
  );
}
