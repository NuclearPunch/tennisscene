import { publicClient } from "./supabase";
import { formatWeekShort } from "./week";
import type {
  Attachment,
  Author,
  AvatarIcon,
  AvatarTone,
  Post,
  PostType,
  RankingPayload,
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
  "id, type, body, payload, is_anonymous, like_count, comment_count, repost_count, created_at, author_handle, author_name, author_kind, author_icon, author_initial, author_tone";

export const PAGE_SIZE = 20;

/** 단체 코드 → 화면 표시명. DB 에는 코드로 저장한다. */
const ORG_LABEL: Record<string, string> = {
  kato: "카토",
  kta: "생체",
  kata: "카타",
};

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
  // 다른 타입은 수집 잡이 붙는 대로 여기에 추가한다 (B-1.3~1.5).
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
  };
}

export type FeedPage = {
  posts: Post[];
  /** 다음 장을 받을 커서. 없으면 끝이다. */
  nextCursor: string | null;
};

/**
 * 시간순 피드. 커서는 `created_at` 이다.
 * offset 페이지네이션은 새 글이 들어오면 경계가 밀려 중복·누락이 생긴다.
 */
export async function loadFeed(cursor?: string): Promise<FeedPage> {
  const db = publicClient();
  let query = db
    .from(VIEW)
    .select(COLUMNS)
    .is("parent_id", null) // 댓글은 피드에 올리지 않는다
    .order("created_at", { ascending: false })
    .limit(PAGE_SIZE);

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
