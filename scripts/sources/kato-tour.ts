/**
 * 카토 대회 수집·게시 — B-1.3
 *
 *   npx tsx scripts/sources/kato-tour.ts --fixture   네트워크 없이 파서만
 *   npx tsx scripts/sources/kato-tour.ts --dry-run   수집만, 게시 안 함
 *   npx tsx scripts/sources/kato-tour.ts             접수 열린 대회를 게시
 *
 * 접수가 열릴 때 한 번만 올린다. 대회는 몇 달을 살기 때문에 매주 올리면
 * 피드가 같은 대회로 도배된다. 중복은 DB 인덱스가 막는다.
 */
import { readFileSync } from "node:fs";
import { jobDb } from "../../src/lib/db";
import { buildTournamentPost } from "../../src/lib/publish/tournamentPost";
import { insertTournamentPost } from "../../src/lib/repositories/posts";
import { katoTournaments as K } from "../../src/lib/sources/katoTournaments";
import { SourceStructureError } from "../../src/lib/sources/types";

const args = new Set(process.argv.slice(2));
const BOT = "b_tour";

async function main() {
  const raw = args.has("--fixture")
    ? readFileSync("tests/fixtures/kato-tournaments.html", "utf-8")
    : await K.fetchList();

  const all = K.parseList(raw);
  const open = all.filter((t) => t.status === "open");
  console.error(
    `대회 ${all.length}건 · 접수중 ${open.length}건 · ` +
      `예정 ${all.filter((t) => t.status === "upcoming").length}건`,
  );

  if (args.has("--dry-run") || args.has("--fixture")) {
    for (const t of open) {
      console.log(`  ${t.startDate}  ${t.name}`);
      console.log(`    ${t.divisions.join(" · ")}`);
    }
    console.error("\n게시하지 않았다.");
    return;
  }

  const db = jobDb();
  let inserted = 0;
  let skipped = 0;

  for (const stub of open) {
    // 장소는 상세에만 있다. 접수중인 것만 상세를 받는다 — 50건을 다 받을 이유가 없다.
    let venue: string | null = null;
    try {
      venue = K.parseDetail(await K.fetchDetail(stub.sourceId), stub.sourceId)
        .venue;
    } catch {
      // 상세가 실패해도 목록만으로 카드는 성립한다. 장소 없이 올린다.
    }

    const post = buildTournamentPost(stub, venue);
    const outcome = await insertTournamentPost(db, BOT, post.body, post.payload);
    if (outcome === "inserted") inserted++;
    else skipped++;
    console.log(`  ${outcome === "inserted" ? "게시" : "중복"} — ${stub.name}`);
  }

  console.log(`\n게시 ${inserted}건 · 중복 건너뜀 ${skipped}건`);
  await db.end();
}

main().catch((err) => {
  if (err instanceof SourceStructureError) {
    console.error(`[구조 변경] ${err.org}: ${err.message}`);
    process.exit(2);
  }
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
