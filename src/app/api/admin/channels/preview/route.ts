import { NextResponse } from "next/server";
import { fail, isCaller, requireAdmin } from "@/lib/api";
import { previewUploads } from "@/lib/jobs/youtube";
import { youtube } from "@/lib/sources/youtube";

export const dynamic = "force-dynamic";

/**
 * 넣기 전에 본다 — 이 채널을 켜면 무엇이 올라가는가.
 *
 * 채널 하나를 판단하려고 손으로 제목을 훑던 일을 화면이 대신한다.
 * 판정은 매일 도는 잡과 같은 함수다(previewUploads).
 */
export async function POST(request: Request) {
  const caller = await requireAdmin(request);
  if (!isCaller(caller)) return caller;

  const key = process.env.YOUTUBE_API_KEY;
  if (!key) return fail(503, "YOUTUBE_API_KEY 가 설정되지 않았습니다");

  const body = (await request.json().catch(() => null)) as { input?: unknown } | null;
  const input = typeof body?.input === "string" ? body.input.trim() : "";
  if (!input) return fail(400, "채널 주소를 넣어주세요");

  let channel;
  try {
    channel = await youtube.resolveChannel(input, key);
  } catch (err) {
    console.error("채널 찾기 실패", err);
    return fail(502, "유튜브에 물어보지 못했습니다. 잠시 뒤 다시 해주세요");
  }
  if (!channel) {
    return fail(
      404,
      "채널을 찾지 못했습니다. 채널 페이지 주소(youtube.com/@이름)를 그대로 붙여넣어 주세요",
    );
  }

  const [videos, existing] = await Promise.all([
    previewUploads(channel.uploads, key).catch(() => null),
    caller.db
      .from("youtube_channels")
      .select("enabled, note")
      .eq("uploads", channel.uploads)
      .maybeSingle(),
  ]);
  if (!videos) return fail(502, "업로드 목록을 받지 못했습니다");

  return NextResponse.json({
    channel,
    // 이미 목록에 있으면(꺼져 있어도) 새로 넣지 않고 켜기로 안내한다.
    existing: existing.data ?? null,
    videos,
  });
}
