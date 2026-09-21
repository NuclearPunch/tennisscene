/**
 * 이미 나간 결과 포스트에 해석 한 줄을 다시 붙인다.
 *
 *   npx tsx scripts/backfill-stories.ts --dry-run   무엇이 붙을지만 본다
 *   npx tsx scripts/backfill-stories.ts             실제로 붙인다
 *
 * 멱등이라 여러 번 돌려도 안전하다. 수집 잡이 대회를 최신순으로 훑기 때문에
 * 한 번에 여러 건을 올린 뒤에는 이걸 한 번 돌려야 이야기가 제대로 선다.
 */
import "./env";
import { runBackfillStories } from "../src/lib/jobs/backfillStories";
import { bail, withDb } from "./run";

const dryRun = new Set(process.argv.slice(2)).has("--dry-run");

withDb((db) => runBackfillStories(db, { dryRun }))
  .then(() => {
    if (dryRun) console.log("[dry-run] 바꾸지 않았다.");
  })
  .catch(bail);
