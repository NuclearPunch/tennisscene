/**
 * 프론트와 백엔드를 잇는 유일한 계약 파일.
 *
 * 세 층으로 나뉜다. 섞지 마라.
 *
 *   1. 공용      — 양쪽이 같이 쓰는 값 유니온. supabase/migrations 의 enum 과 1:1 이다.
 *   2. DB 행     — 테이블 한 행의 모양. 컬럼명 그대로 snake_case 다.
 *                  `*Row` 접미사. 여기에는 표시용 값이 들어가지 않는다.
 *   3. 화면용    — 컴포넌트가 받는 모양. camelCase 이고 이미 다 포맷된 문자열이 들어간다
 *                  (`timeLabel`, `dateLabel`, `duration`...).
 *
 * DB 행 → 화면용 변환은 API 층이 한다(B-2.1). 화면은 DB 행을 직접 보지 않는다.
 * 그래서 "3일 남음" 같은 값이 DB 에 박제되지 않는다.
 *
 * **3층의 이름은 src/components/** 가 그대로 쓴다. 바꾸면 화면이 전부 깨진다.**
 *
 * ────────────────────────────────────────────────────────────
 * 읽기 규칙 — 이걸 어기면 런타임에 42501 이 뜬다
 *
 * `posts` `accounts` `reports` 는 **컬럼 단위로만** select 권한이 있다.
 * supabase-js 의 `.select()` 는 인자가 없으면 `*` 라서 그대로 터진다:
 *
 *     supabase.from('posts').select()            // ✗ permission denied
 *     supabase.from('posts').select('id, body')  // ✓
 *
 * 그래서 base 테이블을 읽을 때는 **컬럼을 반드시 명시한다.**
 *
 * 더 안전한 쪽은 읽기 전용 뷰만 쓰는 것이다. 뷰는 테이블 단위 grant 라 `*` 가 된다:
 *   · 피드·댓글  → `posts_public`             (익명·탈퇴·삭제·차단 처리됨)
 *   · 랭킹        → `ranking_snapshots_public` (비공개 승인 선수 마스킹됨)
 * ────────────────────────────────────────────────────────────
 */

/* ════════════════════════════════════════════════════════════
   1. 공용 — supabase enum 과 같은 값
   ════════════════════════════════════════════════════════════ */

/** DB: account_kind. 봇·브랜드·유저가 모두 같은 계정 테이블을 쓴다. 표시만 배지로 구분한다. */
export type AuthorKind = "bot" | "brand" | "user";

/** accounts 테이블 관점의 이름. AuthorKind 와 같은 값이다. */
export type AccountKind = AuthorKind;

/** DB: avatar_tone */
export type AvatarTone = "green" | "neutral" | "ball";

/** DB: avatar_icon */
export type AvatarIcon =
  | "weather"
  | "chart"
  | "play"
  | "calendar"
  | "box"
  | "ball";

/** DB: post_type. posts 는 단일 테이블이고 이 값으로 payload 가 갈린다. */
export type PostType =
  | "text"
  | "ranking"
  | "tournament"
  | "video"
  | "gear"
  | "score"
  | "weather";

/** DB: report_status */
export type ReportStatus = "open" | "reviewing" | "actioned" | "dismissed";

/** DB: name_removal_status */
export type NameRemovalStatus =
  | "received"
  | "verifying"
  | "approved"
  | "rejected"
  | "done";

/** ISO 주차 문자열. `2026-W37`. 화면 표기(`2026 W37`)와 다르다. */
export type IsoWeek = string;
/** `YYYY-MM-DD` */
export type IsoDate = string;
/** timestamptz 를 JSON 으로 받은 것. `2026-09-18T06:00:00.000Z` */
export type IsoTimestamp = string;

export type Json =
  | string
  | number
  | boolean
  | null
  | Json[]
  | { [key: string]: Json };

/* ════════════════════════════════════════════════════════════
   2. DB 행 — 컬럼명 그대로. 표시용 값은 여기 없다.
   ════════════════════════════════════════════════════════════ */

/** accounts 한 행. 봇·브랜드·유저가 같은 모양이다. */
export type AccountRow = {
  id: string;
  /** auth.users 연결. 사람 유저만 값이 있다. 일반 롤은 이 컬럼을 못 읽는다. */
  auth_user_id: string | null;
  kind: AccountKind;
  handle: string;
  name: string;
  bio: string | null;
  /** 봇·브랜드용 */
  icon: AvatarIcon | null;
  /** 사람 유저용 */
  initial: string | null;
  tone: AvatarTone;
  created_at: IsoTimestamp;
  updated_at: IsoTimestamp;
  deleted_at: IsoTimestamp | null;
};

/* ── posts.payload — 타입별 저장형 ──────────────────────────
   원본 값만 담는다. 라벨·상대시간은 담지 않는다.
   ─────────────────────────────────────────────────────────── */

export type WeatherPayload = {
  region: string;
  tempC: number;
  rainChancePct: number;
  windMs: number;
  forecastFor: IsoDate;
};

export type RankingEntry = {
  rank: number;
  /** ranking_snapshots.player_key. 소스별로 만드는 방법이 다르다. */
  playerKey: string;
  name: string;
  club: string | null;
  /**
   * 직전 주차 대비. 양수 상승, 음수 하락, 0 유지.
   * `null` 은 **비교 불가**다 — 첫 주차이거나 이전 스냅샷이 없을 때.
   */
  delta: number | null;
  /** 이전 주차에 없던 선수. 비교 불가(`delta === null`)와 반드시 구분한다. */
  isNew: boolean;
  points: number | null;
};

export type RankingPayload = {
  org: string;
  division: string;
  region: string | null;
  week: IsoWeek;
  leader: RankingEntry;
  runnersUp: RankingEntry[];
  story: string | null;
};

/** 목록 페이지의 상태. 화면 텍스트가 아니라 클래스로 잡은 값이다. */
export type TournamentStatus = "open" | "upcoming" | "closed";

export type TournamentPayload = {
  org: string;
  /** 소스의 대회 ID. 중복 게시를 막는 키다. */
  sourceId: string;
  name: string;
  /** 그룹 등급 (group1~4 등). 없을 수 있다. */
  grade: string | null;
  /**
   * 상세 페이지에서 얻는다. 요강이 자유 텍스트라 못 읽을 때가 있어 nullable.
   * 접수 마감일은 자유 텍스트 안에만 있어 아예 담지 않는다 — 틀린 마감일은
   * 없는 것보다 나쁘다.
   */
  venue: string | null;
  startsOn: IsoDate;
  endsOn: IsoDate;
  divisions: string[];
  status: TournamentStatus;
  sourceUrl: string;
};

export type VideoPayload = {
  /** videos.id */
  videoId: string;
  provider: string;
  providerVideoId: string;
  title: string;
  channelTitle: string | null;
  durationSeconds: number | null;
  thumbnailUrl: string | null;
  publishedAt: IsoTimestamp | null;
  tournamentName: string | null;
  division: string | null;
  round: string | null;
};

export type GearPayload = {
  product: string;
  spec: string | null;
  /** 원(KRW) 정수 */
  price: number;
  wasPrice: number | null;
  shopUrl: string | null;
  checkedAt: IsoTimestamp;
};

/** score payload 와 화면용 Attachment 가 같이 쓰는 한 쪽 점수. */
export type MatchSide = {
  name: string;
  sets: number[];
  won: boolean;
};

export type ScorePayload = {
  event: string;
  home: MatchSide;
  away: MatchSide;
  playedAt: IsoTimestamp | null;
  sourceUrl: string | null;
};

/** post_type → payload 모양. `text` 는 payload 가 없다. */
export type PostPayloadMap = {
  text: null;
  weather: WeatherPayload;
  ranking: RankingPayload;
  tournament: TournamentPayload;
  video: VideoPayload;
  gear: GearPayload;
  score: ScorePayload;
};

export type PostPayload = PostPayloadMap[PostType];

/**
 * posts 한 행.
 * `PostRow<"ranking">` 처럼 좁히면 payload 가 같이 좁혀진다.
 */
export type PostRow<T extends PostType = PostType> = {
  id: string;
  /** 익명 글도 채워진다. 표시만 익명이고 제재는 계정에 붙는다. */
  author_id: string;
  type: T;
  payload: PostPayloadMap[T];
  body: string | null;
  /** 댓글의 부모. 1단계만 허용한다 — DB 트리거가 대댓글을 거부한다. */
  parent_id: string | null;
  quoted_post_id: string | null;
  is_anonymous: boolean;
  /** 비정규화 카운터. DB 트리거가 유지한다. 애플리케이션에서 쓰지 않는다. */
  like_count: number;
  comment_count: number;
  repost_count: number;
  created_at: IsoTimestamp;
  edited_at: IsoTimestamp | null;
  deleted_at: IsoTimestamp | null;
};

/**
 * posts_public 뷰 한 행 — 읽기는 전부 이걸로 한다.
 * 익명 글이면 작성자 필드가 전부 null 이다. 원본 author_id 는 서버에만 남는다.
 * 삭제·차단은 뷰가 이미 걸러낸 뒤다.
 */
export type PostPublicRow<T extends PostType = PostType> = Omit<
  PostRow<T>,
  "author_id" | "deleted_at"
> & {
  author_id: string | null;
  author_handle: string | null;
  author_name: string | null;
  author_kind: AccountKind;
  author_icon: AvatarIcon | null;
  author_initial: string | null;
  author_tone: AvatarTone;
};

/**
 * ranking_snapshots 한 행. 이 서비스의 심장이다.
 * 원본이 "지난주 대비 변동"을 주지 않으므로 주차별로 통째로 쌓고 우리가 계산한다.
 * delta 는 저장하지 않는다 — 직전 주차와 조인해서 그때 만든다.
 */
export type RankingSnapshotRow = {
  org: string;
  division: string;
  week: IsoWeek;
  /**
   * 카토: `/careers/{id}` 고유 ID.
   * 카타: 고유 ID 가 없어 hash(이름 + 소속클럽).
   * 키 생성 규칙은 소스 어댑터가 소유한다.
   */
  player_key: string;
  rank: number;
  player_name: string;
  club: string | null;
  region: string | null;
  points: number | null;
  source_url: string | null;
  collected_at: IsoTimestamp;
};

export type TournamentRow = {
  id: string;
  org: string;
  source_key: string;
  source_url: string | null;
  name: string;
  venue: string | null;
  region: string | null;
  starts_on: IsoDate | null;
  ends_on: IsoDate | null;
  deadline_at: IsoTimestamp | null;
  divisions: string[];
  /** 우리가 가져온 시각 */
  collected_at: IsoTimestamp;
  /** 봇이 피드에 올린 시각. null 이면 아직 안 올라갔다. */
  posted_at: IsoTimestamp | null;
  post_id: string | null;
};

export type VideoRow = {
  id: string;
  provider: string;
  provider_video_id: string;
  channel_id: string | null;
  channel_title: string | null;
  title: string;
  duration_seconds: number | null;
  thumbnail_url: string | null;
  published_at: IsoTimestamp | null;
  tournament_name: string | null;
  division: string | null;
  round: string | null;
  collected_at: IsoTimestamp;
  /** 유튜브 약관: 메타·썸네일은 30일 내 갱신 또는 삭제. 이 값으로 대상을 고른다. */
  refreshed_at: IsoTimestamp;
  posted_at: IsoTimestamp | null;
  post_id: string | null;
};

export type LikeRow = {
  account_id: string;
  post_id: string;
  created_at: IsoTimestamp;
};

export type RepostRow = {
  account_id: string;
  post_id: string;
  created_at: IsoTimestamp;
};

export type FollowRow = {
  follower_id: string;
  followee_id: string;
  created_at: IsoTimestamp;
};

export type BlockRow = {
  blocker_id: string;
  blocked_id: string;
  created_at: IsoTimestamp;
};

/** service_role 전용. 클라이언트는 일부 컬럼만 select 권한이 있다(reporter_id·detail·resolution_note 제외). */
export type ReportRow = {
  id: string;
  reporter_id: string;
  /** 포스트 신고 또는 계정 신고. 정확히 하나만 채워진다. */
  target_post_id: string | null;
  target_account_id: string | null;
  reason: string;
  detail: string | null;
  status: ReportStatus;
  created_at: IsoTimestamp;
  resolved_at: IsoTimestamp | null;
  resolution_note: string | null;
};

/** 선수 본인이 자기 이름을 내려달라고 요청하는 경로. 비회원도 접수할 수 있다. */
/** service_role 전용. 클라이언트에는 select 권한이 아예 없다 — contact 가 개인정보다. */
export type NameRemovalRequestRow = {
  id: string;
  player_name: string;
  club: string | null;
  org: string | null;
  division: string | null;
  player_key: string | null;
  /** 개인정보. service_role 만 읽는다. */
  contact: string;
  requester_id: string | null;
  message: string | null;
  status: NameRemovalStatus;
  created_at: IsoTimestamp;
  resolved_at: IsoTimestamp | null;
  resolution_note: string | null;
};

/**
 * 이름 비공개가 승인된 선수. `ranking_snapshots_public` 이 이걸 보고 이름을 가린다.
 * 게시 잡은 발행 전에 여기 있는 선수를 걸러야 한다 — 한 번 payload 에 박히면
 * 소급 마스킹(B-5.2)이 필요해진다.
 */
export type SuppressedPlayerRow = {
  org: string;
  player_key: string;
  request_id: string | null;
  reason: string | null;
  created_at: IsoTimestamp;
};

/* ════════════════════════════════════════════════════════════
   3. 화면용 — src/components/** 가 쓰는 이름. 바꾸지 마라.
   API 층이 2층을 이걸로 바꿔서 넘긴다.
   ════════════════════════════════════════════════════════════ */

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

export type RankRow = {
  rank: number;
  name: string;
  club?: string;
  /** 이전 주차에 없던 선수. `delta === null`(비교 불가)과 다르다. */
  isNew?: boolean;
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
      /** 이미 포맷된 문자열. 예: "2m/s" */
      wind: string;
    }
  | {
      type: "ranking";
      org: string;
      division: string;
      region?: string;
      /** 표시용 주차. 예: "2026 W37" (DB 의 IsoWeek 는 "2026-W37") */
      week: string;
      leader: RankRow;
      story?: string;
      runnersUp: RankRow[];
    }
  | {
      type: "video";
      title: string;
      channel: string;
      /** 이미 포맷된 재생시간. 예: "12:04" */
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
      home: MatchSide;
      away: MatchSide;
    }
  | {
      type: "tournament";
      name: string;
      /** 상세를 못 읽으면 비어 있다. */
      venue?: string;
      /** 예: "09.17 (목) — 09.20 (일)" */
      dateLabel: string;
      divisions: string[];
      /** 마감일은 자유 텍스트라 신뢰할 수 없다. 대신 접수 상태를 보여준다. */
      status: TournamentStatus;
      /**
       * 원문 대회 요강. 마감일·참가비·계좌처럼 우리가 못 담는 정보가 거기 있다.
       * 출처로 트래픽을 돌려주는 의미도 있다(docs/DECISIONS.md 법적 리스크).
       */
      sourceUrl: string;
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
  /** 이미 포맷된 시간 표시. 예: "06:00", "2시간", "월 09:00" */
  timeLabel: string;
  body?: string;
  attachment?: Attachment;
  quote?: Quote;
  stats: PostStats;
  liked?: boolean;
};
