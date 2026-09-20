import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { katoSource } from "../src/lib/sources/kato";
import { SourceStructureError } from "../src/lib/sources/types";
import { computeDeltas, formatDelta } from "../src/lib/ranking";
import { isoWeekOf } from "../src/lib/week";

const FIXTURE = readFileSync("tests/fixtures/kato-ranking.html", "utf-8");
const AT = new Date("2026-09-20T12:00:00Z");

test("부서 5개를 탭 순서대로 읽는다", () => {
  const { rows } = katoSource.parse(FIXTURE, AT);
  const divisions = [...new Set(rows.map((r) => r.division))];
  assert.deepEqual(divisions, ["개나리", "국화", "챌린저", "마스터스", "베테랑"]);
  assert.equal(rows.length, 250);
});

test("playerKey 는 playerView 의 선수 ID 이고 부서 코드가 아니다", () => {
  const { rows } = katoSource.parse(FIXTURE, AT);
  const leader = rows.find((r) => r.division === "개나리" && r.rank === 1)!;
  assert.equal(leader.playerKey, "21510");
  assert.equal(leader.playerName, "장선희");
  assert.equal(leader.points, 282);
  assert.match(leader.club!, /대전화목/);
});

test("같은 선수가 여러 부서에 다른 점수로 등재된다", () => {
  // (org, division, week, player_key) 복합키가 필요한 이유.
  const { rows } = katoSource.parse(FIXTURE, AT);
  const appearances = rows.filter((r) => r.playerKey === "16888");
  assert.equal(appearances.length, 2);
  assert.deepEqual(
    appearances.map((r) => r.division).sort(),
    ["마스터스", "챌린저"],
  );
  assert.notEqual(appearances[0].points, appearances[1].points);
});

test("동순위가 존재한다 — rank 는 유니크하지 않다", () => {
  const { rows } = katoSource.parse(FIXTURE, AT);
  const gaenari = rows.filter((r) => r.division === "개나리");
  assert.ok(new Set(gaenari.map((r) => r.rank)).size < gaenari.length);
});

test("테이블 수가 바뀌면 던진다", () => {
  const broken = FIXTURE.replace("kato-ranking", "kato-rankingX");
  assert.throws(() => katoSource.parse(broken, AT), SourceStructureError);
});

test("행을 못 읽으면 조용히 건너뛰지 않고 던진다", () => {
  // 빠진 행은 다음 주 변동 계산을 통째로 틀어놓는다.
  const broken = FIXTURE.replace('class="player-name"', 'class="player-nameX"');
  assert.throws(() => katoSource.parse(broken, AT), SourceStructureError);
});

test("ISO 주차는 목요일 기준으로 연도를 잡는다", () => {
  assert.equal(isoWeekOf(new Date("2026-09-20T00:00:00Z")), "2026-W38");
  // 2027-01-01 은 금요일이라 2026 년 53주차에 속한다
  assert.equal(isoWeekOf(new Date("2027-01-01T00:00:00Z")), "2026-W53");
  // 2026-01-01 은 목요일이라 그 해 1주차다
  assert.equal(isoWeekOf(new Date("2026-01-01T00:00:00Z")), "2026-W01");
});

/* ── B-1.2 변동 계산 ─────────────────────────────────────── */

test("첫 주차는 전원 NEW 가 아니라 비교 불가다", () => {
  const { rows } = katoSource.parse(FIXTURE, AT);
  const { comparable, rows: ranked } = computeDeltas(rows, []);
  assert.equal(comparable, false);
  assert.equal(ranked.every((r) => r.delta === null && !r.isNew), true);
  assert.equal(formatDelta(ranked[0]), "—");
});

test("순위가 오르면 양수다 — 5위에서 2위면 +3", () => {
  const current = [
    { division: "개나리", rank: 2, playerKey: "a", playerName: "가", club: null, points: 100, note: null },
  ];
  const { rows } = computeDeltas(current, [
    { division: "개나리", playerKey: "a", rank: 5 },
  ]);
  assert.equal(rows[0].delta, 3);
  assert.equal(formatDelta(rows[0]), "+3");
});

test("부서가 다르면 다른 랭킹이다 — 같은 선수라도 섞이지 않는다", () => {
  const current = [
    { division: "챌린저", rank: 1, playerKey: "16888", playerName: "김동현", club: null, points: 435, note: null },
    { division: "마스터스", rank: 18, playerKey: "16888", playerName: "김동현", club: null, points: 355, note: null },
  ];
  const { rows } = computeDeltas(current, [
    { division: "챌린저", playerKey: "16888", rank: 3 },
    // 마스터스에는 없었다 → 그 부서에서만 신규
  ]);
  assert.equal(rows[0].delta, 2);
  assert.equal(rows[0].isNew, false);
  assert.equal(rows[1].delta, null);
  assert.equal(rows[1].isNew, true);
});

test("최대 상승자는 하락·신규를 빼고 고른다", () => {
  const mk = (key: string, rank: number) => ({
    division: "개나리", rank, playerKey: key, playerName: key,
    club: null, points: null, note: null,
  });
  const { topRiser } = computeDeltas([mk("a", 1), mk("b", 5), mk("c", 9)], [
    { division: "개나리", playerKey: "a", rank: 3 },  // +2
    { division: "개나리", playerKey: "b", rank: 12 }, // +7
    { division: "개나리", playerKey: "c", rank: 2 },  // -7
  ]);
  assert.equal(topRiser?.playerKey, "b");
  assert.equal(topRiser?.delta, 7);
});
