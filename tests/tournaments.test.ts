import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { buildTournamentPost } from "../src/lib/publish/tournamentPost";
import { katoTournaments as K } from "../src/lib/sources/katoTournaments";
import { SourceStructureError } from "../src/lib/sources/types";

const LIST = readFileSync("tests/fixtures/kato-tournaments.html", "utf-8");
const GAME = readFileSync("tests/fixtures/kato-game-0310.html", "utf-8");

test("목록에서 대회 50건을 읽는다", () => {
  const list = K.parseList(LIST);
  assert.equal(list.length, 50);
  const t = list.find((x) => x.sourceId === "0310")!;
  assert.equal(t.name, "제16회 공주 무령왕배 전국동호인테니스대회");
  assert.equal(t.startDate, "2026-09-17");
  assert.equal(t.endDate, "2026-09-20");
  assert.deepEqual(t.divisions, ["챌린저부", "마스터스부", "국화부", "개나리부"]);
});

test("상태는 화면 텍스트가 아니라 클래스로 잡는다", () => {
  // 텍스트는 바뀌기 쉽고 클래스는 스타일에 묶여 있어 덜 흔들린다.
  const list = K.parseList(LIST);
  const counts = list.reduce<Record<string, number>>(
    (a, t) => ((a[t.status] = (a[t.status] ?? 0) + 1), a),
    {},
  );
  assert.deepEqual(counts, { closed: 36, open: 7, upcoming: 7 });
});

test("모르는 상태 클래스가 나오면 던진다", () => {
  const broken = LIST.replace('class="comblue"', 'class="comPURPLE"');
  assert.throws(() => K.parseList(broken), SourceStructureError);
});

test("대회 행이 깨지면 조용히 건너뛰지 않고 던진다", () => {
  // 대회를 빠뜨리면 접수 마감을 놓친다.
  const broken = LIST.replace('class="date"', 'class="dateX"');
  assert.throws(() => K.parseList(broken), SourceStructureError);
});

test("상세에서 부서별 일정과 장소를 읽는다", () => {
  const d = K.parseDetail(GAME, "0310");
  assert.equal(d.venue, "공주시립테니스코트");
  assert.equal(d.schedules.length, 4);
  assert.equal(d.schedules[0].division, "개나리부");
  assert.match(d.schedules[0].when!, /2026년 09월 17일/);
  assert.equal(d.schedules[0].registration, "접수마감");
});

test("상세는 깨져도 던지지 않는다 — 목록만으로 카드가 성립한다", () => {
  const d = K.parseDetail("<html><body>완전히 다른 페이지</body></html>", "0310");
  assert.equal(d.venue, null);
  assert.deepEqual(d.schedules, []);
});

test("포스트에 마감일을 담지 않는다 — 틀린 마감일은 없는 것보다 나쁘다", () => {
  const stub = K.parseList(LIST).find((t) => t.sourceId === "0310")!;
  const { payload, body } = buildTournamentPost(stub, "공주시립테니스코트");
  assert.equal("deadlineAt" in payload, false);
  assert.equal(payload.sourceUrl, "https://kato.kr/openGame/0310");
  assert.match(body, /09\.17 \(목\) — 09\.20 \(일\)/);
  assert.match(body, /공주시립테니스코트에서 열립니다/);
});

test("장소를 못 읽어도 포스트는 만든다", () => {
  const stub = K.parseList(LIST).find((t) => t.sourceId === "0310")!;
  const { payload, body } = buildTournamentPost(stub, null);
  assert.equal(payload.venue, null);
  assert.match(body, /접수가 시작됐습니다/);
  assert.equal(body.includes("에서 열립니다"), false);
});

test("payload 가 원문 요강 링크를 나른다", () => {
  // 마감일·참가비·계좌는 우리가 못 담는다. 거기로 보내야 한다.
  // 출처로 트래픽을 돌려주는 건 법적 리스크를 낮추는 쪽이기도 하다.
  const stub = K.parseList(LIST).find((t) => t.sourceId === "0321")!;
  const { payload } = buildTournamentPost(stub, null);
  assert.equal(payload.sourceUrl, "https://kato.kr/openGame/0321");
});
