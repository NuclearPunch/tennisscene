import type { Author } from "./types";

/** 봇도 유저와 같은 accounts 테이블의 row다. kind 값만 다르다. */
export const BOTS = {
  today: {
    id: "b_today",
    name: "오늘의 코트",
    handle: "today",
    kind: "bot",
    icon: "weather",
    tone: "green",
  },
  rank: {
    id: "b_rank",
    name: "주간 랭킹",
    handle: "rank",
    kind: "bot",
    icon: "chart",
    tone: "green",
  },
  match: {
    id: "b_match",
    name: "동호인 경기",
    handle: "match",
    kind: "bot",
    icon: "play",
    tone: "green",
  },
  tour: {
    id: "b_tour",
    name: "대회 알림",
    handle: "tour",
    kind: "bot",
    icon: "calendar",
    tone: "green",
  },
  gear: {
    id: "b_gear",
    name: "장비",
    handle: "gear",
    kind: "bot",
    icon: "box",
    tone: "ball",
  },
  pro: {
    id: "b_pro",
    name: "프로 테니스",
    handle: "pro",
    kind: "bot",
    icon: "ball",
    tone: "green",
  },
} satisfies Record<string, Author>;

export function user(name: string, handle: string): Author {
  return {
    id: `u_${handle}`,
    name,
    handle,
    kind: "user",
    initial: name.slice(0, 1),
    tone: "neutral",
  };
}
