import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { buildResultPost } from "../src/lib/publish/resultPost";
import { katoResults as R } from "../src/lib/sources/katoResults";
import { SourceStructureError } from "../src/lib/sources/types";

const GAME = readFileSync("tests/fixtures/kato-game-0310.html", "utf-8");
const DONE = readFileSync("tests/fixtures/kato-result-0310-100.json", "utf-8");
const PENDING = readFileSync(
  "tests/fixtures/kato-result-0310-110.json",
  "utf-8",
);

test("본선대진 탭에서 부서명과 부서 코드를 같이 읽는다", () => {
  // 코드 표를 상수로 박으면 혼합복식부·여자퓨처스부처럼 대회마다 붙는 부서에서 깨진다.
  const parts = R.parseParts(GAME, "0310");
  assert.deepEqual(parts, [
    { division: "개나리부", partCode: "200" },
    { division: "국화부", partCode: "210" },
    { division: "마스터스부", partCode: "110" },
    { division: "챌린저부", partCode: "100" },
  ]);
});

test("부서를 하나도 못 찾으면 던진다", () => {
  assert.throws(
    () => R.parseParts("<html><body>다른 페이지</body></html>", "0310"),
    SourceStructureError,
  );
});

test("결과가 아직 없으면 null 이다 — 실패가 아니다", () => {
  // 같은 대회 안에서도 부서마다 끝나는 날이 다르다. 마스터스부는 아직 진행 중이다.
  assert.equal(R.parseResult(PENDING, "0310", "110", "마스터스부"), null);
});

test("시상대만 읽는다 — 8강 아래는 담지 않는다", () => {
  const r = R.parseResult(DONE, "0310", "100", "챌린저부")!;
  assert.equal(r.division, "챌린저부");
  assert.deepEqual(
    r.champion.players.map((p) => p.name),
    ["조호선", "최혁열"],
  );
  assert.deepEqual(
    r.runnerUp!.players.map((p) => p.name),
    ["우원철", "박정호"],
  );
  assert.equal(r.semifinalists.length, 2);
  // 응답에는 32행이 들어 있다. 우승 1 + 준우승 1 + 공동 3위 2 = 4팀만 남아야 한다.
  assert.equal(1 + 1 + r.semifinalists.length, 4);
});

test("선수 코드를 담는다 — 랭킹의 player_key 와 같은 값이어야 비공개가 걸린다", () => {
  const r = R.parseResult(DONE, "0310", "100", "챌린저부")!;
  assert.equal(r.champion.players[0].playerKey, "26904");
  assert.equal(r.champion.players[0].club, "천안한우리");
});

test("결과가 있다는데 우승이 없으면 던진다", () => {
  // 조용히 넘기면 그날부터 결과 포스트가 통째로 사라지는데 아무도 모른다.
  const broken = JSON.stringify({
    response: 1,
    ptype: "챌린저부",
    list: [{ rank: 2, type: "준우승", p1: "우원철" }],
  });
  assert.throws(
    () => R.parseResult(broken, "0310", "100", "챌린저부"),
    SourceStructureError,
  );
});

test("JSON 이 아니면 던진다", () => {
  assert.throws(
    () => R.parseResult("<html>로그인 페이지</html>", "0310", "100", "챌린저부"),
    SourceStructureError,
  );
});

test("포스트 본문은 우승 조를 말한다", () => {
  const r = R.parseResult(DONE, "0310", "100", "챌린저부")!;
  const post = buildResultPost({
    result: r,
    tournamentName: "제16회 공주 무령왕배 전국동호인테니스대회",
    endsOn: "2026-09-20",
  })!;
  assert.equal(
    post.body,
    "제16회 공주 무령왕배 전국동호인테니스대회 챌린저부, 조호선·최혁열 조가 우승했습니다.",
  );
  assert.equal(post.payload.partCode, "100");
  assert.equal(
    post.payload.sourceUrl,
    "https://kato.kr/qualifiedDraws/0310/100",
  );
});

test("우승자가 이름 비공개면 포스트를 만들지 않는다", () => {
  // 시상대는 우승이 헤드라인이라 가리면 남는 게 없다. 랭킹처럼 한 명만 빼지 못한다.
  const r = R.parseResult(DONE, "0310", "100", "챌린저부")!;
  const post = buildResultPost({
    result: r,
    tournamentName: "제16회 공주 무령왕배 전국동호인테니스대회",
    suppressed: new Set(["26904"]),
  });
  assert.equal(post, null);
});

test("공동 3위가 이름 비공개면 그 팀만 뺀다", () => {
  const r = R.parseResult(DONE, "0310", "100", "챌린저부")!;
  const key = r.semifinalists[0].players[0].playerKey!;
  const post = buildResultPost({
    result: r,
    tournamentName: "제16회 공주 무령왕배 전국동호인테니스대회",
    suppressed: new Set([key]),
  })!;
  assert.equal(post.payload.semifinalists.length, 1);
  assert.equal(post.payload.champion.players[0].name, "조호선");
});

test("단식이면 '조'가 아니라 '선수'다", () => {
  const r = R.parseResult(DONE, "0310", "100", "챌린저부")!;
  r.champion.players = r.champion.players.slice(0, 1);
  const post = buildResultPost({ result: r, tournamentName: "어느 대회" })!;
  assert.match(post.body, /조호선 선수가 우승했습니다/);
});
