import Link from "next/link";
import { EFFECTIVE_DATE } from "@/lib/legal";

/**
 * 약관·방침 문서의 틀. 앱은 이 페이지를 앱 안 브라우저로 연다 — 문서는 한 벌만 둔다.
 * 글자는 15·20 두 크기만 쓴다(CLAUDE.md 규칙 4).
 */
export function LegalPage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-[640px] px-4 pt-[max(env(safe-area-inset-top),16px)] pb-24">
      <Link href="/" className="text-ink-3">
        ← 테니스씬
      </Link>
      <h1 className="mt-4 text-[20px] leading-[26px] font-bold">{title}</h1>
      <p className="mt-1 text-[13px] leading-[18px] text-ink-3">시행일 {EFFECTIVE_DATE}</p>
      <div className="legal mt-6 flex flex-col gap-6">{children}</div>
    </div>
  );
}

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="font-bold">{title}</h2>
      <div className="mt-1 flex flex-col gap-2 text-ink-2 [&_li]:ml-5 [&_li]:list-disc">{children}</div>
    </section>
  );
}
