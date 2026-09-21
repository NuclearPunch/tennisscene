/**
 * 주간 랭킹 게시 — B-1.6
 *
 *   npx tsx scripts/publish.ts --dry-run --fixture   네트워크·DB 없이 문구만 확인
 *   npx tsx scripts/publish.ts                       이번 주 스냅샷을 포스트로
 *
 * **실제 게시 경로는 src/lib/jobs/publish.ts 다.** 크론(/api/cron/daily)도 같은 함수를 부른다.
 *
 * 수집(B-1.2)과 게시를 나눈 이유: 스냅샷을 먼저 뜨고 게시를 나중에 하면
 * 수집이 실패해도 손쓸 시간이 생긴다. 이 잡은 DB 에 이미 있는 스냅샷만 읽는다.
 */
import "./env";
import { readFileSync } from "node:fs";
import { runPublish } from "../src/lib/jobs/publish";
import { buildRankingPost } from "../src/lib/publish/rankingPost";
import { computeDeltas } from "../src/lib/ranking";
import { katoSource } from "../src/lib/sources/kato";
import { bail, withDb } from "./run";

const args = new Set(process.argv.slice(2));

/** DB 없이 문구만 본다. 픽스처를 그 주 스냅샷인 셈 치고 쓴다. */
async function dryRun() {
  const raw = args.has("--fixture")
    ? readFileSync("tests/fixtures/kato-ranking.html", "utf-8")
    : await katoSource.fetchRaw();
  const result = katoSource.parse(raw);

  console.log(`${result.org} · ${result.week} · 게시 미리보기\n`);

  for (const division of katoSource.divisions) {
    const rows = result.rows.filter((r) => r.division === division);
    // 이전 주차가 없으므로 변동도 스토리도 안 붙는다. 첫 주 실제 동작과 같다.
    const { rows: ranked } = computeDeltas(rows, []);
    const post = buildRankingPost({
      org: "kato",
      division,
      week: result.week,
      rows: ranked,
      recentLeaders: [],
    });
    if (!post) continue;
    console.log(`  ${post.body}`);
    console.log(
      `    2~4위 ${post.payload.runnersUp.map((r) => `${r.rank} ${r.name}`).join(" · ")}\n`,
    );
  }
  console.log("[dry-run] 게시하지 않았다.");
}

const main = args.has("--dry-run") ? dryRun : () => withDb(runPublish);

main().catch(bail);
