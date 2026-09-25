/**
 * 웹과 같은 타입을 쓴다(../src/lib/types.ts). **타입만** 가져온다 —
 * `import type` 은 빌드 때 지워져서 앱 번들에 웹 코드가 한 줄도 안 들어간다.
 * 서버 API 가 이 모양 그대로 돌려주므로, 둘이 어긋나면 타입 검사에서 걸린다.
 */
export type {
  Attachment,
  Author,
  AvatarIcon,
  AvatarTone,
  MatchSide,
  PodiumTeam,
  Post,
  PostStats,
  Quote,
  RankRow,
} from "@shared/types";

/** 피드 한 장. 웹의 FeedPage 와 같다(src/lib/feed.ts). */
export type FeedPage = { posts: import("@shared/types").Post[]; nextCursor: string | null };

/**
 * 해시태그 모아보기. 웹의 FEED_TAGS(src/lib/feed.ts)와 **같아야 한다.**
 * 그 파일은 서버 코드를 끌고 와서 앱에서 못 가져온다 — 태그를 더하면 두 곳을 같이 고친다.
 */
export const FEED_TAGS = [
  { slug: "tournament", label: "대회일정" },
  { slug: "result", label: "대회결과" },
  { slug: "video", label: "경기영상" },
  { slug: "ranking", label: "주간랭킹" },
] as const;
