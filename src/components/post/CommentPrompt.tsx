import Link from "next/link";

/**
 * 봇 글 아래의 댓글 유도 줄.
 *
 * 빈 입력칸처럼 생겼다 — 버튼이 아니라 **여기에 쓰면 된다**고 보여야 한다.
 * 큰 상자나 눈에 띄는 버튼으로 만들면 광고 배너처럼 읽혀서 오히려 안 눌린다.
 */
export function CommentPrompt({ postId, text }: { postId: string; text: string }) {
  return (
    <Link
      href={`/p/${postId}`}
      className="hair mt-2 flex h-10 items-center rounded-full px-3.5 text-ink-3"
    >
      {text}
    </Link>
  );
}
