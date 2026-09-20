/**
 * 카토 랭킹 수집 — B-1.1
 *
 *   npx tsx scripts/sources/kato.ts            원격에서 가져와 요약 출력
 *   npx tsx scripts/sources/kato.ts --fixture  저장된 HTML 로 파서만 검증 (네트워크 안 씀)
 *   npx tsx scripts/sources/kato.ts --json     표준 행을 JSON 으로
 *
 * 아직 DB 에 쓰지 않는다. 스냅샷 저장과 변동 계산은 B-1.2 다.
 */
import { readFileSync } from "node:fs";
import { katoSource } from "../../src/lib/sources/kato";
import { SourceStructureError } from "../../src/lib/sources/types";

const args = new Set(process.argv.slice(2));

async function main() {
  const raw = args.has("--fixture")
    ? readFileSync("tests/fixtures/kato-ranking.html", "utf-8")
    : await katoSource.fetchRaw();

  const result = katoSource.parse(raw);

  if (args.has("--json")) {
    process.stdout.write(JSON.stringify(result, null, 2));
    return;
  }

  const byDivision = new Map<string, typeof result.rows>();
  for (const row of result.rows) {
    const list = byDivision.get(row.division) ?? [];
    list.push(row);
    byDivision.set(row.division, list);
  }

  console.log(`${result.org} · ${result.week} · ${result.rows.length}행\n`);

  for (const [division, rows] of byDivision) {
    const top = rows[0];
    const ties = rows.length - new Set(rows.map((r) => r.rank)).size;
    console.log(
      `  ${division.padEnd(5)} ${String(rows.length).padStart(3)}행  ` +
        `1위 ${top.playerName}(${top.points ?? "-"}점)` +
        (ties ? `  동순위 ${ties}건` : ""),
    );
  }

  // 한 선수가 여러 부서에 다른 점수로 동시 등재된다.
  // (org, division, week, player_key) 복합키가 필요한 이유다.
  const seen = new Map<string, string[]>();
  for (const row of result.rows) {
    const at = seen.get(row.playerKey) ?? [];
    at.push(`${row.division} ${row.rank}위`);
    seen.set(row.playerKey, at);
  }
  const multi = [...seen.entries()].filter(([, at]) => at.length > 1);
  console.log(`\n  고유 선수 ${seen.size}명 · 복수 부서 등재 ${multi.length}명`);
  for (const [key, at] of multi.slice(0, 5)) {
    const name = result.rows.find((r) => r.playerKey === key)!.playerName;
    console.log(`    ${name} — ${at.join(" · ")}`);
  }
}

main().catch((err) => {
  if (err instanceof SourceStructureError) {
    // 구조가 바뀌면 게시하지 않는다. 잘못된 데이터보다 없는 게 낫다.
    console.error(`[구조 변경] ${err.org}: ${err.message}`);
    process.exit(2);
  }
  console.error(err);
  process.exit(1);
});
