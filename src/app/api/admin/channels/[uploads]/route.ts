import { NextResponse } from "next/server";
import { fail, isCaller, requireAdmin } from "@/lib/api";

export const dynamic = "force-dynamic";

/**
 * 켜기·끄기·메모 고치기. **지우기는 없다** — 끈 채널도 왜 껐는지가 남아야 한다.
 * 다음 날 아침 수집부터 반영된다.
 */
export async function PATCH(request: Request, ctx: { params: Promise<{ uploads: string }> }) {
  const caller = await requireAdmin(request);
  if (!isCaller(caller)) return caller;
  const { uploads } = await ctx.params;

  const body = (await request.json().catch(() => null)) as { enabled?: unknown; note?: unknown } | null;
  const patch: { enabled?: boolean; note?: string; updated_at: string } = {
    updated_at: new Date().toISOString(),
  };
  if (typeof body?.enabled === "boolean") patch.enabled = body.enabled;
  if (typeof body?.note === "string") patch.note = body.note.trim().slice(0, 1000);
  if (patch.enabled === undefined && patch.note === undefined) {
    return fail(400, "바꿀 것이 없습니다");
  }

  const { data, error } = await caller.db
    .from("youtube_channels")
    .update(patch)
    .eq("uploads", uploads)
    .select("uploads, enabled, note");
  if (error) {
    console.error("채널 수정 실패", error);
    return fail(500, "바꾸지 못했습니다");
  }
  if (!data?.length) return fail(404, "없는 채널입니다");
  return NextResponse.json(data[0]);
}
