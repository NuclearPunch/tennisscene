import Link from "next/link";

export default function ComposePage() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[520px] flex-col border-hairline sm:border-x">
      <header className="flex h-[54px] shrink-0 items-center justify-between border-b border-hairline px-5">
        <Link href="/" className="text-[15px] text-ink-2">
          취소
        </Link>
        <span className="text-[15px] font-semibold tracking-[-0.01em]">새 글</span>
        <button
          type="button"
          disabled
          className="rounded-full bg-grouped px-4 py-1.5 text-[14px] font-semibold text-muted"
        >
          게시
        </button>
      </header>

      <div className="flex grow gap-3 px-5 py-4">
        <div className="h-10 w-10 shrink-0 rounded-full bg-grouped" />
        <div className="grow">
          <label htmlFor="body" className="sr-only">
            내용
          </label>
          <textarea
            id="body"
            rows={8}
            placeholder="무슨 일이 있었나요?"
            className="w-full resize-none bg-transparent text-[15px] leading-[1.6] outline-none placeholder:text-muted"
          />
        </div>
      </div>
    </div>
  );
}
