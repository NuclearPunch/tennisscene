/**
 * 랭킹 포스트 게시 — B-1.6
 *
 *   npx tsx scripts/publish.ts --dry-run --fixture   네트워크·DB 없이 문구만 확인
 *   npx tsx scripts/publish.ts                       이번 주 스냅샷을 포스트로
 *
 * 수집(B-1.2)과 게시를 나눈 이유: 일요일에 스냅샷을 뜨고 월요일에 게시하면
 * 수집이 실패해도 손쓸 시간이 생긴다. 이 잡은 DB 에 이미 있는 스냅샷만 읽는다.
 */
import { readFileSync } from "node:fs";
import { serviceClient } from "../src/lib/db";
import { buildRankingPost } from "../src/lib/publish/rankingPost";
import { computeDeltas } from "../src/lib/ranking";
import {
  insertRankingPost,
  loadSuppressedPlayers,
} from "../src/lib/repositories/posts";
import {
  findPreviousWeek,
  loadDivisions,
  loadRecentLeaders,
  loadWeek,
} from "../src/lib/repositories/rankingSnapshots";
import { katoSource } from "../src/lib/sources/kato";
import { SourceStructureError } from "../src/lib/sources/types";
import { isoWeekOf } from "../src/lib/week";

const args = new Set(process.argv.slice(2));
const ORG = "kato";
const BOT = "b_rank";

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
      org: ORG,
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

async function publish() {
  const db = serviceClient();
  const week = isoWeekOf(new Date());

  const divisions = await loadDivisions(db, ORG, week);
  if (divisions.length === 0) {
    // 스냅샷이 없으면 게시할 게 없다. 실패가 아니라 순서 문제다.
    console.error(`${week} 스냅샷이 없다. 먼저 npm run snapshot 을 돌려라.`);
    process.exit(3);
  }

  const prevWeek = await findPreviousWeek(db, ORG, week);
  const previous = prevWeek ? await loadWeek(db, ORG, prevWeek) : [];
  const suppressed = await loadSuppressedPlayers(db, ORG);
  console.log(
    `${week} · 부서 ${divisions.length}개 · 비교 ${prevWeek ?? "없음"} · 비공개 ${suppressed.size}명`,
  );

  let inserted = 0;
  let skipped = 0;

  for (const division of divisions) {
    const { data, error } = await db
      .from("ranking_snapshots")
      .select("division, rank, player_key, player_name, club, points")
      .eq("org", ORG)
      .eq("week", week)
      .eq("division", division)
      .order("rank", { ascending: true });
    if (error) throw error;

    const rows = (data ?? []).map((r) => ({
      division: r.division as string,
      rank: r.rank as number,
      playerKey: r.player_key as string,
      playerName: r.player_name as string,
      club: r.club as string | null,
      points: r.points as number | null,
      note: null,
    }));

    const { rows: ranked } = computeDeltas(rows, previous);
    const recentLeaders = await loadRecentLeaders(db, ORG, division, week);

    const post = buildRankingPost({
      org: ORG,
      division,
      week,
      rows: ranked,
      recentLeaders,
      suppressed,
    });
    if (!post) {
      console.log(`  ${division}: 게시할 행이 없다 (전원 비공개?)`);
      continue;
    }

    const outcome = await insertRankingPost(db, BOT, post.body, post.payload);
    outcome === "inserted" ? inserted++ : skipped++;
    console.log(`  ${outcome === "inserted" ? "게시" : "중복"} — ${post.body}`);
  }

  console.log(`\n게시 ${inserted}건 · 중복 건너뜀 ${skipped}건`);
}

const main = args.has("--dry-run") ? dryRun : publish;

main().catch((err) => {
  if (err instanceof SourceStructureError) {
    console.error(`[구조 변경] ${err.org}: ${err.message}`);
    process.exit(2);
  }
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
