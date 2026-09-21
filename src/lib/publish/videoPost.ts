import type { VideoPayload } from "@/lib/types";
import type { RawVideo, TitleParts } from "@/lib/sources/youtube";
import { youtube } from "@/lib/sources/youtube";

/**
 * 영상 하나를 포스트로. DB 를 모르는 순수 함수다.
 *
 * 제목을 우리가 다시 쓰지 않는다 — 올린 사람이 붙인 제목이 그 영상의 이름이다.
 * 우리는 앞에 무슨 경기인지만 한 줄 얹는다.
 */
export type BuiltVideoPost = { payload: VideoPayload; body: string };

export function buildVideoPost(
  video: RawVideo,
  parts: TitleParts,
  durationSeconds: number | null,
  videoId: string,
): BuiltVideoPost {
  const payload: VideoPayload = {
    videoId,
    watchUrl: youtube.watchUrl(video.providerVideoId),
    provider: "youtube",
    providerVideoId: video.providerVideoId,
    title: video.title,
    channelTitle: video.channelTitle,
    durationSeconds,
    thumbnailUrl: video.thumbnailUrl,
    publishedAt: video.publishedAt,
    tournamentName: parts.tournamentName,
    division: parts.division,
    round: parts.round,
  };

  // 무슨 경기인지 알면 그걸 말하고, 모르면 채널 이름만 댄다.
  const what = [parts.tournamentName, parts.division, parts.round]
    .filter(Boolean)
    .join(" ");
  const body = what
    ? `${what} 경기 영상이 올라왔습니다.`
    : `${video.channelTitle} 새 영상입니다.`;

  return { payload, body };
}
