import { AvatarGlyph } from "@/components/icons";
import type { Author } from "@/lib/types";

const TONE = {
  green: "bg-green-bg text-green",
  neutral: "bg-grouped text-ink-2",
  ball: "bg-[#f7fae6] text-[#6e8a1e]",
} as const;

export function Avatar({ author, size = 40 }: { author: Author; size?: number }) {
  return (
    <div
      className={`shrink-0 rounded-full flex items-center justify-center ${TONE[author.tone]}`}
      style={{ width: size, height: size }}
    >
      {author.icon ? (
        <AvatarGlyph
          name={author.icon}
          className="w-1/2 h-1/2"
        />
      ) : (
        <span
          className="font-semibold"
          style={{ fontSize: size * 0.38 }}
        >
          {author.initial}
        </span>
      )}
    </div>
  );
}
