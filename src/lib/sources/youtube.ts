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
  {
    uploads: "UUfk8s5xSKyRG-U49r1U0yTA",
    title: "어택 덕스 테니스",
    note:
      "**우리 데이터와 직접 맞물린다.** 'KATO 안성시장배 마스터즈부 결승전! 김재원 강훈식(송도클레이) VS ...' " +
      "처럼 대회·부서·라운드·선수·클럽이 다 들어 있고, 그 대회와 선수가 우리 랭킹·결과에 이미 있다.",
  },
  {
    uploads: "UUgNG4r-KdDIt0pSfcp8d9rw",
    title: "공자테니스",
    note:
      "전남·광주 생활체육 대회. '[2026.제30회] 해남땅끝배 ... (오픈부 결승)' 형식이 일정하다. " +
      "카토가 아닌 대회라 결과 매칭은 안 되지만 동호인 경기 영상으로는 좋다.",
  },
  {
    uploads: "UUOhApwd9XBkeYzsl7fsE2FA",
    title: "KATA TENNIStube",
    note:
      "카타 공식. '[2025 아식스컵 개나리부 결승] 권봉여/최순혜 vs. 정다정/최채영' 로 형식이 가장 깔끔하다. " +
      "2025-08 이후 멈춰 있지만 30일 신선도 필터가 있어 올릴 게 없을 뿐이고, 재개하면 저절로 잡힌다.",
  },
  {
    uploads: "UUiTHNeO-ti75vj3QlFHclAA",
    title: "KATATENNIS",
    note:
      "카타가 지금 쓰는 채널(위 TENNIStube 는 멈췄다). '2026 파티온배 오픈부 준결승2' 처럼 " +
      "대회·부서·라운드만 딱 쓴다. 20편 중 경기 10편이 전부 걸렸고 나머지는 쇼츠였다(2026-09 확인).",
  },
];

/*
 * 살펴봤지만 넣지 않은 곳 — 다시 검토할 때 같은 길을 되밟지 않게 적어둔다.
 * 숫자는 2026-09 에 최근 20편을 이 파일의 parseTitle 과 경기 영상 판정에 실제로 돌려본 것이다.
 *
 * **넣으려면 제목 해석부터 손봐야 하는 곳**
 * · 테니스TV (구독 2.4만) — 815신공 테니스마스터즈 동호인 경기를 4K 로 12~17분씩 올린다.
 *   815신공은 우리 대회 데이터에도 있다. 그런데 20편 중 0편이 걸린다 —
 *   '815신공 테니스마스터즈' 가 대회 이름으로 안 잡히고, "결승진출팀은 과연? ... (4강전)" 에서
 *   라운드를 앞의 '결승' 으로 잘못 읽는다. 괄호 끝의 라운드를 우선하게 고치면 들어올 수 있다.
 *   WTA 슬로모션도 섞여 있지만 1분 미만이라 길이로 걸러진다.
 * · VIEW티플 테니스 (영상 1,288) — 경기도지사기·도민체전 시군 대항전. 10분짜리 실경기가 많은데
 *   '50세부·20세부' 가 부서 목록에 없고 '경기도지사기' 도 대회로 안 잡혀 0편이다.
 *   걸리는 3편은 전부 쇼츠였다.
 * · THE TENNIS방극종 (구독 6.8천) — '[더 테니스 ] 2026 비슬산배 국화부 4강전' 형식이라 15편이 걸리지만
 *   채널 머리말 '더 테니스' 를 대회 이름으로 읽는다. 게다가 2026-06 이후 멈췄다.
 * · 지스타테니스 — '[전국 남자 복식 최고수전 4강] 안병건, 지현종 VS ...' 로 깔끔하고 우리 랭킹 선수가
 *   나오지만, '최고수전' 이 대회로 안 잡혀 0편이다. 2025-10 이후 멈췄다.
 *
 * **넣어도 거의 안 나오는 곳**
 * · 최인테니스 — 순천만국가정원배 지도자부. 걸리는 5편 중 4편이 쇼츠라 길이로 걸러내면 1편 남는다.
 *
 * **동호인 대회 영상이 아닌 곳**
 * · 야메테니스 (구독 5.5천, 영상 1,597) — 수가 제일 많지만 대부분 해시태그 범벅 쇼츠다.
 *   제목의 '#오픈부' 는 경기 부서가 아니라 검색용 태그라 걸러내는 게 맞다.
 * · 장군테니스 (구독 2.3천) — 지역 초청대회 위주에 2026-05 이후 멈췄다.
 * · 대한테니스협회TV · 이형택TV · 정진화테니스레슨 — 프로 중계·레슨·예능이다.
 *   우리는 동호인 미디어다(docs/DECISIONS.md). 정진화는 대회 결승도 있지만 2019년 것들이다.
 * · 양구매치 — 주니어 대회(초등부·고등부·16세부).
 * · 테니스에미친남자들 · CS테니스 — 클럽 연습 게임. '박인용(오픈부)' 는 선수 소개지 경기 부서가 아니다.
 * · 메모리슬립 테니스팀 — 클럽 입상 홍보 쇼츠. 해시태그 범벅이라 야메테니스와 같은 이유로 뺀다.
 * · 테니스피플 (영상 4,905) — 요즘 제목이 '20260920092141 1' 같은 타임스탬프다.
 * · 아테TV (2024-03) · 테테테 (2023-11) — 멈췄다.
 * · WS테니스 · 스까치자 · 올마이티 — 레슨·쇼츠·프로.
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

  /** 재생은 유튜브에서. 우리가 직접 틀지 않는다(API 약관). */
  watchUrl: (id: string) => `https://www.youtube.com/watch?v=${id}`,
};
