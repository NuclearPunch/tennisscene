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
  /** 왜 넣었는지. 채널을 빼고 넣을 때 근거가 남아야 한다. */
  note: string;
};

/**
 * 동호인 영상을 올리는 채널.
 *
 * 프로 중계 채널(대한테니스협회TV 등)은 넣지 않았다 — 우리는 동호인 미디어다
 * (docs/DECISIONS.md). 유튜브 영상은 그 채널이 유튜브에 올린 자기 콘텐츠이고
 * 퍼가라고 만든 플랫폼이라, 단체 데이터 이용 제한(생체 약관)과는 다른 문제다.
 */
export const CHANNELS: Channel[] = [
  {
    uploads: "UUgQVX3fx6bazHfD6VLCADbA",
    title: "KATO Tennis",
    note: "카토 공식. 제목 규칙이 가장 정확하다(대회·부서·라운드·선수). 다만 업로드가 뜸하다.",
  },
  {
    uploads: "UUeXOI5jmoJmhumQ-JlO_1pA",
    title: "클라스테니스",
    note: "동호인 실전 경기 전문. 활발하지만 제목이 홍보문구에 가까워 메타데이터를 덜 믿는다.",
  },
  {
    uploads: "UUzL5Vf5U9Ir_5cAQPVfKtgQ",
    title: "테니스라이브",
    note: "동호인 대회 라이브 중계. 제목이 조각나 있어(선수만, 부서만) 대회명이 빠질 때가 많다.",
  },
];

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
const DIVISIONS =
  "개나리|국화|챌린저|마스터스|베테랑|신인|여자퓨처스|퓨처스|혼합복식|지도자|금배|오픈";
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
  const head = s.split(/[(（[［|]/)[0];
  const m = head.match(/(?:\d{4,5}\s*)?(?:제?\s*\d+\s*회\s*)?([가-힣A-Za-z0-9 ]{2,20}?(?:배|컵|오픈))/);
  if (!m) return null;
  // 채널이 연도를 오타 내기도 한다("026 안성시 LTC배"). 공백이 뒤따를 때만 떼서
  // '815신공회장배' 처럼 숫자가 이름의 일부인 경우를 지키다.
  const name = m[1].replace(/^\d{3,5}\s+/, "").trim();
  // 'KATO랭킹시상식' 처럼 대회가 아닌 것이 걸리지 않게 길이를 본다.
  return name.length >= 2 && name.length <= 20 ? name : null;
}

export function parseTitle(rawTitle: string): TitleParts {
  const s = clean(rawTitle);
  const division =
    s.match(DIVISION_WITH_ROUND)?.[1] ?? s.match(DIVISION_BRACKETED)?.[1] ?? null;
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

  /** 재생은 유튜브에서. 우리가 직접 틀지 않는다(API 약관). */
  watchUrl: (id: string) => `https://www.youtube.com/watch?v=${id}`,
};
