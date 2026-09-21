/**
 * 주차 스냅샷 저장 + 변동 계산 — B-1.2
 *
 *   npx tsx scripts/snapshot.ts --dry-run             DB 없이 이번 주 수집만
 *   npx tsx scripts/snapshot.ts --dry-run --fixture   네트워크도 없이
 *   npx tsx scripts/snapshot.ts                       수집해서 DB 에 저장
 *   npx tsx scripts/snapshot.ts --sql | psql ...      DB 에 직접 넣을 SQL 만 뽑는다
 *
 * **실제 저장 경로는 src/lib/jobs/snapshot.ts 다.** 크론(/api/cron/daily)도 같은 함수를 부른다.
 * 여기 남은 건 DB 를 안 건드리는 CLI 전용 경로뿐이다.
 */
import "./env";
import { readFileSync } from "node:fs";
import { runSnapshot } from "../src/lib/jobs/snapshot";
import { computeDeltas } from "../src/lib/ranking";
import { katoSource } from "../src/lib/sources/kato";
import { bail, withDb } from "./run";

const args = new Set(process.argv.slice(2));

async function main() {
  if (!args.has("--dry-run") && !args.has("--sql")) {
    await withDb(runSnapshot);
    return;
  }

  const raw = args.has("--fixture")
    ? readFileSync("tests/fixtures/kato-ranking.html", "utf-8")
    : await katoSource.fetchRaw();
  const result = katoSource.parse(raw);
  // --sql 모드에선 stdout 이 SQL 이다. 요약은 stderr 로 보낸다.
  console.error(`${result.org} · ${result.week} · ${result.rows.length}행 수집`);

  if (args.has("--sql")) {
    const lit = (v: string | null) => (v === null ? "null" : `'${v.replace(/'/g, "''")}'`);
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

  const { comparable } = computeDeltas(result.rows, []);
  console.log(
    `\n[dry-run] 저장하지 않았다. 이전 주차를 못 보므로 변동은 계산하지 않는다 (comparable=${comparable}).`,
  );
}

main().catch(bail);
