import { AvatarGlyph } from "@/components/icons";
import type { Author } from "@/lib/types";

/**
 * 자동 게시 계정은 **꽉 찬 원**이다. 옅은 원에 선 아이콘을 얹은 모양은
 * 계정이 아니라 설정 화면의 메뉴 아이콘처럼 읽힌다. 공식 계정의 프로필 사진은
 * 로고이고, 로고는 단색으로 꽉 차 있다.
 */
const TONE = {
  green: "bg-green-deep text-ball",
  ball: "bg-ball text-green-deep",
  neutral: "bg-grouped text-ink-2",
} as const;

export function Avatar({ author, size = 40 }: { author: Author; size?: number }) {
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full ${TONE[author.tone]}`}
      style={{ width: size, height: size }}
    >
      {author.icon ? (
        <AvatarGlyph name={author.icon} className="h-1/2 w-1/2" />
      ) : (
        <span className="font-semibold" style={{ fontSize: size * 0.42 }}>
          {author.initial}
        </span>
      )}
    </div>
  );
}
