/** 봇·브랜드·유저가 모두 같은 계정 테이블을 쓴다. 표시만 배지로 구분한다. */
export type AuthorKind = "bot" | "brand" | "user";

export type AvatarTone = "green" | "neutral" | "ball";

export type Author = {
  id: string;
  name: string;
  handle: string;
  kind: AuthorKind;
  /** 봇·브랜드는 아이콘, 유저는 이니셜 */
  icon?: AvatarIcon;
  initial?: string;
  tone: AvatarTone;
};

export type AvatarIcon =
  | "weather"
  | "chart"
  | "play"
  | "calendar"
  | "box"
  | "ball";

export type RankRow = {
  rank: number;
  name: string;
  club?: string;
  /** 지난주 대비. 양수 상승, 음수 하락, null 신규, 0 유지 */
  delta: number | null;
  points?: number;
};

export type Attachment =
  | {
      type: "weather";
      region: string;
      temp: number;
      rainChance: number;
      wind: string;
    }
  | {
      type: "ranking";
      org: string;
      division: string;
      region?: string;
      week: string;
      leader: RankRow;
      story?: string;
      runnersUp: RankRow[];
    }
  | {
      type: "video";
      title: string;
      channel: string;
      duration: string;
      source: string;
    }
  | {
      type: "gear";
      product: string;
      spec: string;
      price: number;
      wasPrice?: number;
    }
  | {
      type: "score";
      event: string;
      home: { name: string; sets: number[]; won: boolean };
      away: { name: string; sets: number[]; won: boolean };
    }
  | {
      type: "tournament";
      name: string;
      venue: string;
      dateLabel: string;
      deadlineLabel: string;
      daysLeft: number;
      divisions: string[];
    };

export type Quote = {
  authorName: string;
  authorHandle: string;
  authorKind: AuthorKind;
  icon?: AvatarIcon;
  summary: string;
};

export type PostStats = {
  replies: number;
  reposts: number;
  likes: number;
};

export type Post = {
  id: string;
  author: Author;
  timeLabel: string;
  body?: string;
  attachment?: Attachment;
  quote?: Quote;
  stats: PostStats;
  liked?: boolean;
};
