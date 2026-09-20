/**
 * 주차 스냅샷 저장 + 변동 계산 — B-1.2
 *
 *   npx tsx scripts/snapshot.ts --dry-run             DB 없이 이번 주 수집만
 *   npx tsx scripts/snapshot.ts --dry-run --fixture   네트워크도 없이
 *   npx tsx scripts/snapshot.ts                       수집해서 DB 에 저장
 *   npx tsx scripts/snapshot.ts --sql | psql ...       service_role 키 없이 직접 연결로
 *
 * 수집과 게시는 분리한다. 이 잡은 스냅샷만 쌓고 포스트는 만들지 않는다(B-1.6).
 * 일요일에 스냅샷을 뜨고 월요일에 게시하면, 수집이 실패해도 손쓸 시간이 생긴다.
 */
import { readFileSync } from "node:fs";
import { jobDb } from "../src/lib/db";
import { computeDeltas, formatDelta } from "../src/lib/ranking";
import {
  findPreviousWeek,
  loadWeek,
  saveSnapshot,
} from "../src/lib/repositories/rankingSnapshots";
import { katoSource } from "../src/lib/sources/kato";
import { SourceStructureError } from "../src/lib/sources/types";

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");

async function main() {
  const raw = args.has("--fixture")
    ? readFileSync("tests/fixtures/kato-ranking.html", "utf-8")
    : await katoSource.fetchRaw();

  const result = katoSource.parse(raw);
  // --sql 모드에선 stdout 이 SQL 이다. 요약은 stderr 로 보낸다.
  console.error(`${result.org} · ${result.week} · ${result.rows.length}행 수집`);

  if (args.has("--sql")) {
    // service_role 키 없이 DB 에 직접 넣을 때. 배치 잡은 PostgREST 를 거칠 이유가 없다.
    const lit = (v: string | null) =>
      v === null ? "null" : `'${v.replace(/'/g, "''")}'`;
    const num = (v: number | null) => (v === null ? "null" : String(v));

    console.log("begin;");
    for (const r of result.rows) {
      console.log(
        `insert into ranking_snapshots (org,division,week,player_key,player_name,club,rank,points,collected_at) values (` +
          `${lit(result.org)},${lit(r.division)},${lit(result.week)},${lit(r.playerKey)},` +
          `${lit(r.playerName)},${lit(r.club)},${r.rank},${num(r.points)},${lit(result.collectedAt)}) ` +
          `on conflict (org,division,week,player_key) do update set ` +
          `player_name=excluded.player_name, club=excluded.club, rank=excluded.rank, ` +
          `points=excluded.points, collected_at=excluded.collected_at;`,
      );
    }
    console.log("commit;");
    return;
  }

  if (dryRun) {
    const { comparable } = computeDeltas(result.rows, []);
    console.log(
      `\n[dry-run] 저장하지 않았다. 이전 주차를 못 보므로 변동은 계산하지 않는다 (comparable=${comparable}).`,
    );
    return;
  }

  const db = jobDb();

  const prevWeek = await findPreviousWeek(db, result.org, result.week);
  const previous = prevWeek ? await loadWeek(db, result.org, prevWeek) : [];
  console.log(
    prevWeek
      ? `직전 주차 ${prevWeek} · ${previous.length}행과 비교한다`
      : "직전 주차가 없다. 이번 주는 변동을 표시하지 않는다",
  );

  const saved = await saveSnapshot(db, result);
  console.log(`스냅샷 ${saved}행 저장`);

  const { rows, comparable, topRiser } = computeDeltas(result.rows, previous);
  if (!comparable) {
    await db.end();
    return;
  }

  const moved = rows.filter((r) => r.delta !== null && r.delta !== 0);
  const entered = rows.filter((r) => r.isNew);
  console.log(`\n변동 ${moved.length}건 · 신규 진입 ${entered.length}명`);
  if (topRiser) {
    console.log(
      `최대 상승 ${topRiser.playerName} (${topRiser.division}) ${formatDelta(topRiser)}`,
    );
  }

  await db.end();
}

main().catch((err) => {
  if (err instanceof SourceStructureError) {
    // 구조가 바뀌면 저장하지 않는다. 잘못된 스냅샷은 다음 주 변동까지 오염시킨다.
    console.error(`[구조 변경] ${err.org}: ${err.message}`);
    process.exit(2);
  }
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
