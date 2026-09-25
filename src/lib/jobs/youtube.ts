import type { Sql } from "postgres";
import { buildVideoPost } from "@/lib/publish/videoPost";
import {
  insertVideoPost,
  loadFreshVideos,
  loadPostedVideoIds,
  upsertVideo,
} from "@/lib/repositories/posts";
import { loadEnabledChannels } from "@/lib/repositories/channels";
import { parseTitle, type TitleParts, youtube } from "@/lib/sources/youtube";
import { SourceStructureError } from "@/lib/sources/types";
import type { JobReport } from "./types";

const BOT = "b_match";

/** 채널당 훑는 업로드 수. 하루 한 번 도니까 20이면 놓치지 않는다. */
const PER_CHANNEL = 20;

/**
 * 이보다 오래된 영상은 올리지 않는다.
 * 카토 채널은 마지막 업로드가 8개월 전이다 — 그걸 "새 영상입니다" 라고 올리면 거짓말이다.
 * 수집(videos 테이블)은 그대로 한다. 게시만 안 한다.
 */
const FRESH_DAYS = 30;

/**
 * 이 길이 이하는 쇼츠일 수 있다. 유튜브 쇼츠 상한이 3분이다.
 *
 * 올라간 경기 영상 중 제일 짧은 게 8분 18초였고, 그 아래는 28초짜리 쇼츠 하나뿐이었다.
 * 사이가 넓어서 선을 어디 그어도 되지만, 쇼츠 상한에 맞춰 둔다.
 */
const SHORTS_MAX_SECONDS = 180;

/**
 * **경기 영상만 올린다.**
 *
 * 채널에는 쇼츠 하이라이트("도대체 몇 번을 살리는 거야?!"), 시상식, 장학금 전달도 섞여 있다.
 * 제목에서 대회나 (부서 + 라운드)를 건졌다는 건 그게 경기 영상이라는 뜻이다.
 * 못 건졌으면 올리지 않는다 — 거르지 않으면 한 번에 60건이 피드를 덮는다.
 *
 * **길이도 본다.** 쇼츠도 제목은 "마스터즈부 결승전!" 이라 제목만으로는 못 가른다.
 * 28초짜리가 "결승 경기 영상" 으로 올라간 적이 있다.
 * 길이를 모르면 올리지 않는다 — 다음 날 다시 받아서 판단한다.
 */
export function isMatchVideo(
  parts: { tournamentName: string | null; division: string | null; round: string | null },
  seconds: number | null,
): boolean {
  if (seconds === null || seconds <= SHORTS_MAX_SECONDS) return false;
  return Boolean(parts.tournamentName || (parts.division && parts.round));
}

function isFresh(publishedAt: string, now: Date): boolean {
  const age = now.getTime() - Date.parse(publishedAt);
  return Number.isFinite(age) && age <= FRESH_DAYS * 86400_000;
}

/**
 * 동호인 경기 영상 수집·게시 — B-1.4
 *
 * **search.list 를 루프에 넣지 않는다.** 100 유닛이라 하루 할당량을 금방 태운다.
 * 채널 ID 는 상수로 박아두고 `playlistItems.list`(1 유닛)로 업로드만 훑는다.
 * 재생시간은 `videos.list`(50개당 1 유닛). 채널 셋이면 하루 6 유닛쯤 쓴다.
 *
 * 한 채널이 죽어도 나머지는 돈다 — 채널 하나가 비공개로 바뀌었다고
 * 그날 영상을 통째로 못 올릴 이유가 없다.
 */
export async function runYoutube(
  db: Sql,
  opts: { dryRun?: boolean } = {},
): Promise<JobReport> {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) {
    return {
      job: "youtube",
      summary: "YOUTUBE_API_KEY 가 없다. 수집하지 않았다",
      lines: [],
    };
  }

  const lines: string[] = [];
  const dry = opts.dryRun === true;
  const now = new Date();

  /*
   * 아는 것은 건드리지 않는다.
   *
   * 채널 여섯을 매일 훑으면 영상 120건이 나오는데, 거의 전부가 어제도 본 것들이다.
   * 그걸 매번 다시 쓰면 DB 왕복만 120번이라 잡 하나가 50초를 먹었다.
   * 두 번의 조회로 바꾼다.
   */
  const [fresh, posted] = dry
    ? [new Map<string, number | null>(), new Set<string>()]
    : await Promise.all([
        loadFreshVideos(db, "youtube"),
        loadPostedVideoIds(db, "youtube"),
      ]);
  let inserted = 0;
  let duplicate = 0;
  let failed = 0;
  let skipped = 0;

  // 채널은 관리자 화면에서 켜고 끈다. 다 꺼져 있으면 할 일이 없다 — 실패가 아니다.
  const channels = await loadEnabledChannels(db);
  if (channels.length === 0) {
    return { job: "youtube", summary: "켜진 채널이 없다. 수집하지 않았다", lines: [] };
  }

  for (const channel of channels) {
    let videos;
    try {
      videos = await youtube.fetchUploads(channel.uploads, key, PER_CHANNEL);
    } catch (err) {
      failed++;
      lines.push(
        `${channel.title}: 못 받았다 — ${err instanceof Error ? err.message : err}`,
      );
      continue;
    }

    /*
     * 새로 쓸 것만 재생시간을 받는다. 이미 아는 영상은 길이도 이미 안다.
     *
     * 길이를 모르는 채로 저장된 영상(그날 videos.list 가 실패했다)은 아는 걸로 치지 않는다.
     * 길이가 없으면 경기 영상 판정을 못 하니까, 받아질 때까지 매일 다시 받는다.
     */
    const isKnown = (id: string) => typeof fresh.get(id) === "number";
    const need = videos.filter((v) => !isKnown(v.providerVideoId));
    const durations = await youtube
      .fetchDurations(need.map((v) => v.providerVideoId), key)
      .catch(() => new Map<string, number | null>());

    lines.push(`${channel.title} — 업로드 ${videos.length}건 · 새로 볼 것 ${need.length}건`);

    for (const v of videos) {
      const parts = parseTitle(v.title);
      const seconds = durations.get(v.providerVideoId) ?? fresh.get(v.providerVideoId) ?? null;
      const worth = isMatchVideo(parts, seconds) && isFresh(v.publishedAt, now);

      if (dry) {
        if (!worth) {
          skipped++;
          continue;
        }
        const what = [parts.tournamentName, parts.division, parts.round]
          .filter(Boolean)
          .join(" ");
        lines.push(`  ${what || "—"}  ${v.title.slice(0, 44)}`);
        inserted++;
        continue;
      }

      // videos 에 먼저 넣는다. 게시를 건너뛰더라도 수집 기록은 남아야
      // 유튜브 약관이 요구하는 30일 갱신 대상을 추적할 수 있다.
      // 이미 알고 갱신할 때도 안 됐으면 건드리지 않는다.
      const known = isKnown(v.providerVideoId);
      if (known && (!worth || posted.has(v.providerVideoId))) {
        if (!worth) skipped++;
        else duplicate++;
        continue;
      }

      // 게시하지 않더라도 수집은 한다 — 30일 갱신 대상을 추적해야 하고,
      // 나중에 대회 결과와 영상을 맞출 때 쓸 재료이기도 하다.
      const videoId = known
        ? null
        : await upsertVideo(db, {
            providerVideoId: v.providerVideoId,
            title: v.title,
            channelTitle: v.channelTitle,
            durationSeconds: seconds,
            thumbnailUrl: v.thumbnailUrl,
            publishedAt: v.publishedAt,
            ...parts,
          });

      if (!worth) {
        skipped++;
        continue;
      }
      if (videoId === null) {
        // 영상은 아는데 포스트가 없다. 흔치 않지만(전에 걸러졌다가 조건이 바뀐 경우)
        // 그때는 id 를 다시 받아와야 한다.
        duplicate++;
        continue;
      }

      const post = buildVideoPost(v, parts, seconds, videoId);
      const outcome = await insertVideoPost(db, BOT, post.body, post.payload);
      if (outcome === "inserted") inserted++;
      else duplicate++;
    }
  }

  if (failed === channels.length) {
    // 전부 실패했으면 유튜브 쪽 문제다. 조용히 넘기면 영상이 왜 안 오는지 모른다.
    throw new SourceStructureError("모든 채널에서 업로드를 못 받았다", "youtube");
  }

  return {
    job: "youtube",
    summary:
      `영상 ${dry ? "게시 예정" : "게시"} ${inserted}건 · 중복 ${duplicate}건 · ` +
      `경기 아니거나 오래됨 ${skipped}건` +
      (failed > 0 ? ` · 채널 ${failed}개 실패` : ""),
    lines,
  };
}

export type PreviewVideo = {
  providerVideoId: string;
  title: string;
  publishedAt: string;
  seconds: number | null;
  parts: TitleParts;
  /** 경기 영상으로 판정됐나. 잡이 쓰는 isMatchVideo 그대로다. */
  match: boolean;
  /** 게시 대상 기간(최근 30일) 안인가 */
  fresh: boolean;
};

/**
 * 채널을 넣기 전에 **실제로 무엇이 올라갈지** 본다.
 *
 * 매일 도는 잡과 같은 함수(parseTitle · isMatchVideo · 30일)로 판정한다.
 * 화면용으로 따로 짜면 "미리보기에선 잡히는데 실제론 안 올라가는" 일이 생긴다.
 * 3 유닛쯤 든다(업로드 1 + 길이 1 + 채널 찾기 1).
 */
export async function previewUploads(uploads: string, key: string): Promise<PreviewVideo[]> {
  const videos = await youtube.fetchUploads(uploads, key, PER_CHANNEL);
  const durations = await youtube.fetchDurations(videos.map((v) => v.providerVideoId), key);
  const now = new Date();
  return videos.map((v) => {
    const parts = parseTitle(v.title);
    const seconds = durations.get(v.providerVideoId) ?? null;
    return {
      providerVideoId: v.providerVideoId,
      title: v.title,
      publishedAt: v.publishedAt,
      seconds,
      parts,
      match: isMatchVideo(parts, seconds),
      fresh: isFresh(v.publishedAt, now),
    };
  });
}
