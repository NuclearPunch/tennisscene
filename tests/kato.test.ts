import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { katoSource } from "../src/lib/sources/kato";
import { SourceStructureError } from "../src/lib/sources/types";
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
