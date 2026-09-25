import type { Sql } from "postgres";
import type { Channel } from "@/lib/sources/youtube";

/**
 * 수집할 유튜브 채널. 관리자 화면에서 켜고 끈다(`youtube_channels`).
 *
 * 잡은 직접 연결이라 RLS 를 거치지 않는다. 관리자 정책은 화면 쪽 경로에만 걸린다.
 */
export async function loadEnabledChannels(db: Sql): Promise<Channel[]> {
  return db<Channel[]>`
    select uploads, title from youtube_channels
    where enabled
    order by created_at`;
}
