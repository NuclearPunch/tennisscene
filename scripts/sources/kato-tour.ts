/**
 * 카토 대회 일정 수집·게시 — B-1.3
 *
 *   npx tsx scripts/sources/kato-tour.ts --fixture   네트워크 없이 파서만
 *   npx tsx scripts/sources/kato-tour.ts --dry-run   수집만, 게시 안 함
 *   npx tsx scripts/sources/kato-tour.ts             접수 열린 대회를 게시
 *
 * **실제 게시 경로는 src/lib/jobs/tournaments.ts 다.** 크론(/api/cron/daily)도 같은 함수를 부른다.
 */
import "../env";
import { readFileSync } from "node:fs";
import { runTournaments } from "../../src/lib/jobs/tournaments";
import { katoTournaments as K } from "../../src/lib/sources/katoTournaments";
import { bail, withDb } from "../run";

const args = new Set(process.argv.slice(2));

async function main() {
  if (!args.has("--dry-run") && !args.has("--fixture")) {
    await withDb(runTournaments);
    return;
  }

  const raw = args.has("--fixture")
    ? readFileSync("tests/fixtures/kato-tournaments.html", "utf-8")
    : await K.fetchList();

  const all = K.parseList(raw);
  const open = all.filter((t) => t.status === "open");
  console.log(
    `대회 ${all.length}건 · 접수중 ${open.length}건 · ` +
      `예정 ${all.filter((t) => t.status === "upcoming").length}건\n`,
  );
  for (const t of open) {
    console.log(`  ${t.startDate}  ${t.name}`);
    console.log(`    ${t.divisions.join(" · ")}`);
  }
  console.log("\n게시하지 않았다.");
}

main().catch(bail);
