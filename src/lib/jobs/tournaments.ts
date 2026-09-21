import type { Sql } from "postgres";
import { buildTournamentPost } from "@/lib/publish/tournamentPost";
import { insertTournamentPost } from "@/lib/repositories/posts";
import { katoTournaments as K } from "@/lib/sources/katoTournaments";
import type { JobReport } from "./types";

const BOT = "b_tour";

/**
 * 대회 일정 게시 — B-1.3
 *
 * 접수가 열릴 때 한 번만 올린다. 대회는 몇 달을 살기 때문에 매번 올리면
 * 피드가 같은 대회로 도배된다. 중복은 `posts_tournament_once_idx` 가 막는다.
 */
export async function runTournaments(db: Sql): Promise<JobReport> {
  const lines: string[] = [];
  const all = K.parseList(await K.fetchList());
  const open = all.filter((t) => t.status === "open");
  lines.push(`대회 ${all.length}건 · 접수중 ${open.length}건`);

  let inserted = 0;
  let skipped = 0;

  for (const stub of open) {
    // 장소는 상세에만 있다. 접수중인 것만 상세를 받는다 — 50건을 다 받을 이유가 없다.
    let venue: string | null = null;
    try {
      venue = K.parseDetail(await K.fetchDetail(stub.sourceId), stub.sourceId).venue;
    } catch {
      // 상세가 실패해도 목록만으로 카드는 성립한다. 장소 없이 올린다.
    }

    const post = buildTournamentPost(stub, venue);
    const outcome = await insertTournamentPost(db, BOT, post.body, post.payload);
    if (outcome === "inserted") inserted++;
    else skipped++;
    lines.push(`${outcome === "inserted" ? "게시" : "중복"} — ${stub.name}`);
  }

  return {
    job: "tournaments",
    summary: `대회 일정 게시 ${inserted}건 · 중복 ${skipped}건`,
    lines,
  };
}
