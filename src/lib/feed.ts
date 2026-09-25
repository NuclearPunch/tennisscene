import { expandDivision } from "./divisions";
import { commentPrompt } from "./prompt";
import { publicClient } from "./supabase";
import { formatWeekShort } from "./week";
import type {
  Attachment,
  Author,
  AvatarIcon,
  AvatarTone,
  Post,
  PodiumTeam,
  PostType,
  RankingPayload,
  ResultPayload,
  VideoPayload,
  ResultTeam,
  TournamentPayload,
} from "./types";

/**
 * `posts_public` 한 행을 화면용 `Post` 로 바꾼다.
 *
 * DB 행과 화면용 타입을 나눈 이유가 여기 있다 — "2시간" 같은 표시용 문자열이
 * DB 에 박제되지 않는다. 변환은 여기 한 곳에서만 한다.
 */

/** 피드 읽기는 base 테이블이 아니라 뷰로 한다. 컬럼 권한 때문에 `select *` 가 막혀 있다. */
const VIEW = "posts_public";
const COLUMNS =
  "id, parent_id, type, body, payload, is_anonymous, like_count, comment_count, repost_count, created_at, author_handle, author_name, author_kind, author_icon, author_initial, author_tone";

export const PAGE_SIZE = 20;

/**
 * 해시태그 모아보기.
 *
 * **탭이 아니다.** 기본 상태는 아무것도 안 눌린 단일 피드이고, 누르면 걸리고
 * 다시 누르면 풀린다. 기본 선택된 "전체" 칩을 두는 순간 그건 콘텐츠 탭이 된다
 * (CLAUDE.md 규칙 1). 정렬은 걸려 있든 아니든 시간순 그대로다.
 *
 * 지금은 포스트 타입에서 파생한다. 나중에 유저 글 본문의 해시태그가 생기면
 * 같은 `?tag=` 공간에 얹는다 — 그래서 slug 가 타입 이름과 따로 논다.
 *
 * **수집 잡이 새 타입을 올리기 시작하면 여기에도 줄을 더한다.**
 * 안 더하면 그 글은 피드에는 뜨는데 어떤 태그로도 모이지 않는다.
 */
export type FeedTag = {
  /** URL 파라미터이자 DOM key. 한글을 그대로 쓰면 인코딩이 지저분해진다. */
  slug: string;
  /** 화면 표기. `#` 는 컴포넌트가 붙인다. */
  label: string;
  types: PostType[];
};

/**
 * 봇이 실제로 피드에 올리는 타입.
 *
 * **새 수집 잡을 붙이면 여기와 `FEED_TAGS` 를 같이 고쳐야 한다.**
 * 한쪽만 고치면 그 글은 피드에 뜨는데 어떤 태그로도 안 모인다 —
 * 유튜브를 붙이고 태그를 안 더해서 영상 45건이 그렇게 떠 있었다.
 * 둘이 어긋나면 테스트가 잡는다(tests/feedTags.test.ts).
 */
export const PUBLISHED_TYPES = [
  "tournament",
  "result",
  "video",
  "ranking",
] as const satisfies readonly PostType[];

export const FEED_TAGS: FeedTag[] = [
  { slug: "tournament", label: "대회일정", types: ["tournament"] },
  { slug: "result", label: "대회결과", types: ["result"] },
  { slug: "video", label: "경기영상", types: ["video"] },
  { slug: "ranking", label: "주간랭킹", types: ["ranking"] },
];

export function findFeedTag(slug?: string | null): FeedTag | undefined {
  return slug ? FEED_TAGS.find((t) => t.slug === slug) : undefined;
}

/** 이 타입의 글에 붙는 해시태그. 봇 계정 이름만으로는 안 갈린다 —
 *  '대회 알림' 은 대회 일정과 대회 결과를 둘 다 올린다. */
export function tagOfType(type: PostType): FeedTag | undefined {
  return FEED_TAGS.find((t) => (t.types as readonly PostType[]).includes(type));
}

/** 단체 코드 → 화면 표시명. DB 에는 코드로 저장한다. */
const ORG_LABEL: Record<string, string> = {
  kato: "카토",
  kta: "생체",
  kata: "카타",
};

/** `2026-09-17` → `09.17 (목)` */
function dayLabel(iso: string): string {
  // UTC 자정으로 만들고 UTC 로 읽는다. KST 로 만들어 UTC 로 읽으면 9시간만큼
  // 하루가 밀려서 요일이 틀린다. 날짜 문자열의 요일은 시간대와 무관해야 한다.
  const d = new Date(`${iso}T00:00:00Z`);
  const dow = ["일", "월", "화", "수", "목", "금", "토"][d.getUTCDay()];
  return `${iso.slice(5, 7)}.${iso.slice(8, 10)} (${dow})`;
}

/** 복식 한 조는 붙여 쓴다. 소속은 못 읽은 선수가 있으면 이름과 개수가 안 맞을 수 있다. */
function podium(team: ResultTeam): PodiumTeam {
  const clubs = team.players
    .map((p) => p.club)
    .filter(Boolean)
    .join("·");
  return {
    names: team.players.map((p) => p.name).join("·"),
    clubs: clubs || undefined,
  };
}

/** 초 → `12:04` · `1:02:03` */
function durationLabel(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

function dateRangeLabel(from: string, to: string): string {
  return from === to ? dayLabel(from) : `${dayLabel(from)} — ${dayLabel(to)}`;
}

function timeLabel(iso: string, now = Date.now()): string {
  const diff = Math.max(0, now - new Date(iso).getTime());
  const min = Math.floor(diff / 60000);
  if (min < 1) return "방금";
  if (min < 60) return `${min}분`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간`;
  const day = Math.floor(hr / 24);
  if (day === 1) return "어제";
  if (day < 7) return `${day}일`;
  const d = new Date(iso);
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}

type Row = {
  id: string;
  type: PostType;
  body: string | null;
  payload: unknown;
  is_anonymous: boolean;
  like_count: number;
  comment_count: number;
  repost_count: number;
  created_at: string;
  author_handle: string | null;
  author_name: string | null;
  author_kind: Author["kind"];
  author_icon: AvatarIcon | null;
  author_initial: string | null;
  author_tone: AvatarTone;
};

function toAuthor(row: Row): Author {
  // 익명 글이나 탈퇴 계정은 뷰가 이름을 비워서 준다.
  const name = row.author_name ?? (row.is_anonymous ? "익명" : "알 수 없음");
  return {
    id: row.author_handle ?? row.id,
    name,
    handle: row.author_handle ?? "anonymous",
    kind: row.author_kind,
    icon: row.author_icon ?? undefined,
    initial: row.author_icon ? undefined : (row.author_initial ?? name.slice(0, 1)),
    tone: row.author_tone,
  };
}

function toAttachment(row: Row): Attachment | undefined {
  if (row.type === "ranking") {
    const p = row.payload as RankingPayload;
    return {
      type: "ranking",
      org: ORG_LABEL[p.org] ?? p.org,
      division: `${p.division}부`,
      region: p.region ?? undefined,
      week: formatWeekShort(p.week),
      leader: {
        rank: p.leader.rank,
        name: p.leader.name,
        club: p.leader.club ?? undefined,
        delta: p.leader.delta,
        isNew: p.leader.isNew,
      },
      story: p.story ?? undefined,
      runnersUp: p.runnersUp.map((r) => ({
        rank: r.rank,
        name: r.name,
        club: r.club ?? undefined,
        delta: r.delta,
        isNew: r.isNew,
      })),
    };
  }
  if (row.type === "tournament") {
    const p = row.payload as TournamentPayload;
    return {
      type: "tournament",
      name: p.name,
      venue: p.venue ?? undefined,
      dateLabel: dateRangeLabel(p.startsOn, p.endsOn),
      divisions: p.divisions,
      status: p.status,
      sourceUrl: p.sourceUrl,
    };
  }
  if (row.type === "result") {
    const p = row.payload as ResultPayload;
    return {
      type: "result",
      // 부서명은 소스가 "챌린저부"처럼 이미 '부'를 달아서 준다. 랭킹과 달리 붙이지 않는다.
      scope: `${ORG_LABEL[p.org] ?? p.org} ${p.division}`,
      tournament: p.tournamentName,
      dateLabel: p.endsOn ? dayLabel(p.endsOn) : undefined,
      champion: podium(p.champion),
      story: p.story ?? undefined,
      pointsLine: p.pointsLine ?? undefined,
      runnerUp: p.runnerUp ? podium(p.runnerUp) : undefined,
      semifinalists: p.semifinalists.map(podium),
      sourceUrl: p.sourceUrl,
    };
  }
  if (row.type === "video") {
    const p = row.payload as VideoPayload;
    return {
      type: "video",
      title: p.title,
      channel: p.channelTitle ?? "",
      duration: p.durationSeconds ? durationLabel(p.durationSeconds) : undefined,
      thumbnailUrl: p.thumbnailUrl ?? undefined,
      watchUrl: p.watchUrl,
      tournament: p.tournamentName ?? undefined,
      division: p.division ?? undefined,
      round: p.round ?? undefined,
    };
  }
  // 나머지 타입은 수집 잡이 붙는 대로 여기에 추가한다 (B-1.5).
  return undefined;
}

function toPost(row: Row, now?: number): Post {
  return {
    id: row.id,
    author: toAuthor(row),
    timeLabel: timeLabel(row.created_at, now),
    body: row.body ?? undefined,
    attachment: toAttachment(row),
    stats: {
      replies: row.comment_count,
      reposts: row.repost_count,
      likes: row.like_count,
    },
    hashtag: row.author_kind === "bot" ? tagOfType(row.type) : undefined,
    prompt:
      commentPrompt({
        type: row.type,
        payload: row.payload,
        authorKind: row.author_kind,
        commentCount: row.comment_count,
      }) ?? undefined,
  };
}

export type FeedPage = {
  posts: Post[];
  /** 다음 장을 받을 커서. 없으면 끝이다. */
  nextCursor: string | null;
};

/** 검색어의 최소 길이. 한 글자로는 거의 전부가 걸려서 검색이 아니게 된다. */
export const SEARCH_MIN = 2;

/**
 * 글 검색 (F-4.1).
 *
 * **선수 명부를 만들지 않는다**(CLAUDE.md). 본문·대회명·영상 제목·부서만 본다.
 * 범위와 이유는 `search_posts` 함수 주석에 적혀 있다.
 */
export async function searchPosts(q: string): Promise<Post[]> {
  const term = q.trim();
  if (term.length < SEARCH_MIN) return [];

  // 같은 부서의 다른 이름까지 같이 찾는다. 오픈부 == 마스터스부 == 마스터즈부.
  const terms = expandDivision(term);

  const db = publicClient();
  const { data, error } = await db.rpc("search_posts", { qs: terms, lim: PAGE_SIZE });
  if (error) throw error;

  const now = Date.now();
  return ((data ?? []) as unknown as Row[]).map((r) => toPost(r, now));
}

/**
 * 글 하나와 그 댓글. 포스트 상세 화면이 쓴다.
 *
 * 댓글은 **오래된 순**이다. 피드는 최신순이지만 댓글은 대화라서
 * 위에서 아래로 읽혀야 한다.
 */
export async function loadThread(
  id: string,
): Promise<{ post: Post; comments: Post[] } | null> {
  const db = publicClient();
  const [root, replies] = await Promise.all([
    db.from(VIEW).select(COLUMNS).eq("id", id).maybeSingle(),
    db.from(VIEW).select(COLUMNS).eq("parent_id", id).order("created_at", { ascending: true }),
  ]);

  if (root.error) throw root.error;
  if (!root.data) return null; // 삭제됐거나 없는 글
  if (replies.error) throw replies.error;

  const now = Date.now();
  return {
    post: toPost(root.data as unknown as Row, now),
    comments: ((replies.data ?? []) as unknown as Row[]).map((r) => toPost(r, now)),
  };
}

/**
 * 시간순 피드. 커서는 `created_at` 이다.
 * offset 페이지네이션은 새 글이 들어오면 경계가 밀려 중복·누락이 생긴다.
 *
 * `tag` 는 거르기만 한다. 순서는 건드리지 않는다.
 * 모르는 slug 는 무시하고 전체를 준다 — 오타 난 URL 로 빈 화면을 주지 않는다.
 */
export async function loadFeed(
  cursor?: string,
  tag?: string | null,
): Promise<FeedPage> {
  const db = publicClient();
  let query = db
    .from(VIEW)
    .select(COLUMNS)
    .is("parent_id", null) // 댓글은 피드에 올리지 않는다
    .order("created_at", { ascending: false })
    .limit(PAGE_SIZE);

  const filter = findFeedTag(tag);
  if (filter) query = query.in("type", filter.types);
  if (cursor) query = query.lt("created_at", cursor);

  const { data, error } = await query;
  if (error) throw error;

  const rows = (data ?? []) as unknown as Row[];
  const now = Date.now();

  return {
    posts: rows.map((r) => toPost(r, now)),
    nextCursor:
      rows.length === PAGE_SIZE ? rows[rows.length - 1].created_at : null,
  };
}
