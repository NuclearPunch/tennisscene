/**
 * 유튜브 영상 수집·게시 — B-1.4
 *
 *   npx tsx scripts/sources/youtube.ts --dry-run   무엇이 올라갈지만 본다
 *   npx tsx scripts/sources/youtube.ts             게시한다
 *
 * 실제 경로는 src/lib/jobs/youtube.ts 다. 크론(/api/cron/daily)도 같은 함수를 부른다.
 */
import "../env";
import { runYoutube } from "../../src/lib/jobs/youtube";
import { bail, withDb } from "../run";

const dryRun = new Set(process.argv.slice(2)).has("--dry-run");

withDb((db) => runYoutube(db, { dryRun }))
  .then(() => {
    if (dryRun) console.log("[dry-run] 게시하지 않았다.");
  })
  .catch(bail);
