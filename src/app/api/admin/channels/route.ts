import { NextResponse } from "next/server";
import { fail, isCaller, requireAdmin } from "@/lib/api";
import { youtube } from "@/lib/sources/youtube";

export const dynamic = "force-dynamic";

/** 채널 목록과 채널별 성적(수집·게시 수, 마지막 업로드). */
export async function GET(request: Request) {
  const caller = await requireAdmin(request);
  if (!isCaller(caller)) return caller;

  const { data, error } = await caller.db.rpc("admin_channel_stats");
  if (error) {
    console.error("채널 목록 실패", error);
    return fail(500, "채널 목록을 못 읽었습니다");
  }
  return NextResponse.json({ channels: data });
}

/**
 * 채널 넣기.
 *
 * 화면이 보낸 제목을 믿지 않고 **서버에서 다시 찾는다.** 저장되는 건 유튜브가 말한 이름이다 —
 * 영상과 채널을 이름으로 잇기 때문에(admin_channel_stats) 이름이 틀리면 성적이 0 으로 보인다.
 */
export async function POST(request: Request) {
  const caller = await requireAdmin(request);
  if (!isCaller(caller)) return caller;

  const key = process.env.YOUTUBE_API_KEY;
  if (!key) return fail(503, "YOUTUBE_API_KEY 가 설정되지 않았습니다");

  const body = (await request.json().catch(() => null)) as { input?: unknown; note?: unknown } | null;
  const input = typeof body?.input === "string" ? body.input : "";
  const note = typeof body?.note === "string" ? body.note.trim().slice(0, 1000) : "";

  const found = await youtube.resolveChannel(input, key).catch(() => null);
  if (!found) return fail(404, "채널을 찾지 못했습니다");

  const { error } = await caller.db.from("youtube_channels").insert({
    uploads: found.uploads,
    title: found.title,
    handle: found.handle,
    note,
  });
  if (error) {
    if (error.code === "23505") return fail(409, "이미 목록에 있는 채널입니다");
    console.error("채널 추가 실패", error);
    return fail(500, "채널을 넣지 못했습니다");
  }
  return NextResponse.json({ uploads: found.uploads, title: found.title }, { status: 201 });
}
