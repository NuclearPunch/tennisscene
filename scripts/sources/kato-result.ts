/**
 * 카토 대회 결과 수집·게시 — B-1.7
 *
 *   npx tsx scripts/sources/kato-result.ts --fixture   네트워크 없이 대상 대회만
 *   npx tsx scripts/sources/kato-result.ts --dry-run   수집만, 게시 안 함
 *   npx tsx scripts/sources/kato-result.ts             끝난 부서를 게시
 *
 * **실제 게시 경로는 src/lib/jobs/results.ts 다.** 크론(/api/cron/daily)도 같은 함수를 부른다.
 */
import "../env";
import { readFileSync } from "node:fs";
import { candidates, runResults } from "../../src/lib/jobs/results";
import { katoTournaments as K } from "../../src/lib/sources/katoTournaments";
import { bail, withDb } from "../run";

const args = new Set(process.argv.slice(2));

async function main() {
  if (args.has("--fixture")) {
    const all = K.parseList(readFileSync("tests/fixtures/kato-tournaments.html", "utf-8"));
    const targets = candidates(all);
    console.log(`대회 ${all.length}건 · 결과를 확인할 대회 ${targets.length}건\n`);
    for (const t of targets) console.log(`  ${t.startDate} ~ ${t.endDate}  ${t.name}`);
    console.log("\n[fixture] 결과는 받지 않았다.");
    return;
  }

  const dryRun = args.has("--dry-run");
  await withDb((db) => runResults(db, { dryRun }));
  if (dryRun) console.log("[dry-run] 게시하지 않았다.");
}

main().catch(bail);
