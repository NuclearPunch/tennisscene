import { SourceStructureError } from "./types";

/**
 * 유튜브 수집 — B-1.4
 *
 * **search.list 를 루프에 넣지 않는다.** 100 유닛이라 하루 할당량(10,000)을
 * 금방 태운다. 채널 ID 는 한 번 찾아 상수로 박아두고, 매일은
 * `playlistItems.list`(1 유닛) 로 업로드 목록만 훑는다. 재생시간은
 * `videos.list`(50개당 1 유닛) 로 한 번에 받는다. 하루 총 5~6 유닛이면 끝난다.
 *
 * **유튜브 API 약관**: 저장한 메타데이터·썸네일은 30일 안에 다시 확인하거나 지워야 한다.
 * 그래서 `videos.refreshed_at` 이 있다(supabase/migrations 5/8).
 * 재생은 반드시 유튜브로 보낸다 — 우리가 영상을 직접 틀지 않는다.
 */

const API = "https://www.googleapis.com/youtube/v3";

export type Channel = {
  /** 업로드 재생목록 ID. 채널 ID 의 `UC` 를 `UU` 로 바꾼 값이다. */
  uploads: string;
  title: string;
};

/** 관리자가 붙여넣은 주소로 찾은 채널. */
export type ResolvedChannel = Channel & {
  handle: string | null;
  subscribers: number | null;
  videoCount: number | null;
  thumbnailUrl: string | null;
};

/**
 * 관리자가 붙여넣는 모양들. 유튜브 주소는 여러 꼴로 돈다.
 *
 *   https://www.youtube.com/@jangguntennis      → 핸들
 *   https://youtube.com/@jangguntennis/videos   → 핸들
 *   @jangguntennis                              → 핸들
 *   https://www.youtube.com/channel/UCo4x…      → 채널 ID
 *   UCo4x… / UUo4x…                             → 채널 ID / 업로드 목록
 *
 * `/c/이름` `/user/이름` 옛 주소는 API 로 못 찾는다(forUsername 은 옛 계정만 된다).
 * 그런 건 채널 페이지에서 @핸들 주소를 복사해 달라고 한다.
 */
export function parseChannelInput(raw: string):
  | { kind: "handle"; value: string }
  | { kind: "id"; value: string }
  | null {
  // 주소창에서 복사한 한글 핸들은 '@' 까지 인코딩돼 온다(%40%ED%85%8C…). 통째로 먼저 푼다.
  let s = raw.trim();
  try {
    s = decodeURIComponent(s);
  } catch {
    // 깨진 인코딩이면 받은 그대로 읽는다
  }
  const id = s.match(/(?:^|\/channel\/)(U[CU][A-Za-z0-9_-]{22})(?:$|[/?#])/);
  if (id) return { kind: "id", value: `UC${id[1].slice(2)}` };
  // 핸들은 유튜브가 한글도 허용한다(@테니스라이브).
  const h = s.match(/(?:^|youtube\.com\/)(@[^/?#\s]+)/);
  return h ? { kind: "handle", value: h[1] } : null;
}

/*
 * 채널 목록은 DB(`youtube_channels`)에 있다. 관리자 화면에서 넣고 끈다.
 * 넣은 이유·뺀 이유도 거기 note 에 있다 — 예전엔 이 파일 주석이었다.
 */

export type RawVideo = {
  providerVideoId: string;
  title: string;
  channelTitle: string;
  publishedAt: string;
  thumbnailUrl: string | null;
};

/** 제목에서 건져낸 것. **확신이 없으면 null 이다.** */
export type TitleParts = {
  tournamentName: string | null;
  division: string | null;
  round: string | null;
};

/** 카토·카타가 쓰는 부서 이름. `2부` 같은 건 여기 없어서 안 걸린다. */
/*
 * 부서 이름. 채널마다 철자가 다르다 — 카토는 '마스터스부', 어택 덕스는 '마스터즈부' 로 쓴다.
 * 생활체육 대회는 '일반부·골드부·실버부' 를 쓴다. 둘 다 받는다.
 * `2부` 같은 건 여기 없어서 안 걸린다.
 */
const DIVISIONS =
  "개나리|국화|챌린저|마스터스|마스터즈|베테랑|신인|여자퓨처스|퓨처스|혼합복식|혼복|지도자|금배|일반|골드|실버|오픈";
const ROUNDS = "결승리그\\s*\\d*경기?|준결승\\s*\\d*|결승\\s*\\d*|\\d+강|예선";

/**
 * 부서는 **라운드와 붙어 있거나 대괄호 안에 있을 때만** 믿는다.
 *
 * 홍보형 제목에는 상대 선수의 배경으로 부서가 나온다 —
 * "지도자부 우승 유성운! 16강 빅매치" 에서 경기 부서는 지도자부가 아니다.
 * 반면 "마스터스부 결승", "[ 국화부 16강 ]" 은 그 경기의 부서가 맞다.
 */
const DIVISION_WITH_ROUND = new RegExp(`(${DIVISIONS})부\\s*(?:${ROUNDS})`);
const DIVISION_BRACKETED = new RegExp(`[[［]\\s*(${DIVISIONS})부`);
/**
 * '혼합복식' 은 '부' 없이 쓰는 채널이 있다("[2025 아식스컵 혼합복식 결승]").
 * 다른 부서까지 '부' 를 빼고 받으면 "국화 4명의 승부" 같은 문장이 걸려서, 이것만 예외로 둔다.
 */
const MIXED_WITH_ROUND = new RegExp(`(혼합복식|혼복)\\s*(?:${ROUNDS})`);
const ROUND_RE = new RegExp(`(${ROUNDS})`);

/** 해시태그·이모지·홍보 꼬리말을 걷어낸다. */
function clean(title: string): string {
  return title
    .replace(/#[^\s#]+/g, "")
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "")
    .replace(/Amateur Tennis Match/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * 대회명. `2026 제36회 순천만국가정원배 전국 동호인 테니스 대회` → `순천만국가정원배`
 * 연도·회차를 떼고 `배|컵|오픈` 으로 끝나는 첫 덩어리를 잡는다.
 */
function tournamentOf(s: string): string | null {
  // 괄호 안은 보통 선수 이름이라 버린다. **대괄호는 버리지 않는다** —
  // '[2025 아식스컵 개나리부 결승] ...' 처럼 대회명이 그 안에 들어가는 채널이 있다.
  const head = s
    .replace(/[(（][^)）]*[)）]/g, " ")
    .replace(/[[［\]］]/g, " ")
    .split("|")[0];
  // 연도 뒤에 점이 붙는 채널이 있다("[2026.제30회]").
  const m = head.match(/(?:\d{4,5}[.\s]*)?(?:제?\s*\d+\s*회\s*)?([가-힣A-Za-z0-9 ]{2,20}?(?:배|컵|오픈))/);
  if (!m) return null;
  // 채널이 연도를 오타 내기도 한다("026 안성시 LTC배"). 공백이 뒤따를 때만 떼서
  // '815신공회장배' 처럼 숫자가 이름의 일부인 경우를 지키다.
  // 대괄호를 공백으로 바꾸면서 앞에 공백이 붙을 수 있다. 먼저 다듬고 연도를 뗀다.
  const name = m[1].trim().replace(/^\d{3,5}\s+/, "").trim();
  // 'KATO랭킹시상식' 처럼 대회가 아닌 것이 걸리지 않게 길이를 본다.
  return name.length >= 2 && name.length <= 20 ? name : null;
}

export function parseTitle(rawTitle: string): TitleParts {
  const s = clean(rawTitle);
  const division =
    s.match(DIVISION_WITH_ROUND)?.[1] ??
    s.match(DIVISION_BRACKETED)?.[1] ??
    s.match(MIXED_WITH_ROUND)?.[1] ??
    null;
  const round = s.match(ROUND_RE)?.[1]?.replace(/\s+/g, "") ?? null;
  return {
    tournamentName: tournamentOf(s),
    division: division ? `${division}부` : null,
    round,
  };
}

/** `PT1H2M3S` → 초. 못 읽으면 null. */
export function parseDuration(iso: string | undefined): number | null {
  const m = iso?.match(/^P(?:\d+D)?T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!m) return null;
  return Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
}

async function call(path: string, params: Record<string, string>, key: string) {
  const q = new URLSearchParams({ ...params, key });
  const res = await fetch(`${API}/${path}?${q}`);
  const body = (await res.json()) as {
    error?: { message: string; errors?: { reason?: string }[] };
  };
  if (!res.ok) {
    const reason = body.error?.errors?.[0]?.reason ?? "unknown";
    throw new SourceStructureError(
      `youtube ${path} ${res.status} (${reason}): ${body.error?.message ?? ""}`,
      "youtube",
    );
  }
  return body as Record<string, unknown>;
}

export const youtube = {
  org: "youtube",

  /** 채널의 최근 업로드. 1 유닛. */
  async fetchUploads(uploads: string, key: string, max = 20): Promise<RawVideo[]> {
    const d = (await call(
      "playlistItems",
      { part: "snippet", playlistId: uploads, maxResults: String(max) },
      key,
    )) as { items?: { snippet: Record<string, never> }[] };

    return (d.items ?? []).map((i) => {
      const s = i.snippet as unknown as {
        title: string;
        channelTitle: string;
        publishedAt: string;
        resourceId: { videoId: string };
        thumbnails?: Record<string, { url: string }>;
      };
      const t = s.thumbnails ?? {};
      return {
        providerVideoId: s.resourceId.videoId,
        title: s.title,
        channelTitle: s.channelTitle,
        publishedAt: s.publishedAt,
        thumbnailUrl: (t.maxres ?? t.standard ?? t.high ?? t.medium ?? t.default)?.url ?? null,
      };
    });
  },

  /** 재생시간. 50개까지 1 유닛. */
  async fetchDurations(ids: string[], key: string): Promise<Map<string, number | null>> {
    const out = new Map<string, number | null>();
    for (let i = 0; i < ids.length; i += 50) {
      const d = (await call(
        "videos",
        { part: "contentDetails", id: ids.slice(i, i + 50).join(",") },
        key,
      )) as { items?: { id: string; contentDetails?: { duration?: string } }[] };
      for (const v of d.items ?? []) out.set(v.id, parseDuration(v.contentDetails?.duration));
    }
    return out;
  },

  /** 주소·핸들로 채널을 찾는다. 1 유닛. 못 찾으면 null. */
  async resolveChannel(raw: string, key: string): Promise<ResolvedChannel | null> {
    const input = parseChannelInput(raw);
    if (!input) return null;
    const d = (await call(
      "channels",
      {
        part: "snippet,statistics,contentDetails",
        ...(input.kind === "handle" ? { forHandle: input.value } : { id: input.value }),
      },
      key,
    )) as {
      items?: {
        snippet: {
          title: string;
          customUrl?: string;
          thumbnails?: Record<string, { url: string }>;
        };
        statistics?: { subscriberCount?: string; videoCount?: string; hiddenSubscriberCount?: boolean };
        contentDetails: { relatedPlaylists: { uploads: string } };
      }[];
    };
    const c = d.items?.[0];
    if (!c) return null;
    const num = (v: string | undefined) => (v === undefined ? null : Number(v));
    const t = c.snippet.thumbnails ?? {};
    return {
      uploads: c.contentDetails.relatedPlaylists.uploads,
      title: c.snippet.title,
      handle: c.snippet.customUrl ?? (input.kind === "handle" ? input.value : null),
      subscribers: c.statistics?.hiddenSubscriberCount ? null : num(c.statistics?.subscriberCount),
      videoCount: num(c.statistics?.videoCount),
      thumbnailUrl: (t.medium ?? t.default)?.url ?? null,
    };
  },

  /** 재생은 유튜브에서. 우리가 직접 틀지 않는다(API 약관). */
  watchUrl: (id: string) => `https://www.youtube.com/watch?v=${id}`,
};
