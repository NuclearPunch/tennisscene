import assert from "node:assert/strict";
import { test } from "node:test";
import { buildRankingPost } from "../src/lib/publish/rankingPost";
import type { RankedRow } from "../src/lib/ranking";

const row = (
  rank: number,
  key: string,
  name: string,
  extra: Partial<RankedRow> = {},
): RankedRow => ({
  division: "오픈",
  rank,
  playerKey: key,
  playerName: name,
  club: "수원레이크",
  points: 100 - rank,
  note: null,
  delta: 0,
  isNew: false,
  ...extra,
});

const base = {
  org: "kato",
  division: "오픈",
  week: "2026-W38",
  recentLeaders: [] as string[],
};

test("1위와 2~10위를 담는다 — 카드는 3명만 보여주고 나머지는 더보기로 편다", () => {
  const names = ["가","나","다","라","마","바","사","아","자","차","카","타"];
  const post = buildRankingPost({
    ...base,
    rows: names.map((n, i) => row(i + 1, `k${i}`, n)),
  })!;
  assert.equal(post.payload.leader.name, "가");
  // 12명을 줘도 10위까지만 담는다
  assert.equal(post.payload.runnersUp.length, 9);
  assert.equal(post.payload.runnersUp.at(-1)!.rank, 10);
  assert.equal(post.body, "2026년 38주차 오픈부 1위는 가 선수입니다.");
});

test("payload 가 비교 불가와 신규 진입을 구분해서 나른다", () => {
  // 화면이 첫 주차에 전원 NEW 를 찍지 않으려면 isNew 가 payload 까지 와야 한다.
  const post = buildRankingPost({
    ...base,
    rows: [
      row(1, "a", "가", { delta: null, isNew: false }),
      row(2, "b", "나", { delta: null, isNew: true }),
    ],
  })!;
  assert.equal(post.payload.leader.isNew, false);
  assert.equal(post.payload.runnersUp[0].isNew, true);
});

test("payload 에 playerKey 가 들어간다 — 나중에 이름을 되짚으려면 필요하다", () => {
  const post = buildRankingPost({ ...base, rows: [row(1, "p_9001", "가"), row(2, "p_9002", "나")] })!;
  assert.equal(post.payload.leader.playerKey, "p_9001");
  assert.equal(post.payload.runnersUp[0].playerKey, "p_9002");
});

test("5계단 이상 오르면 스토리가 붙는다", () => {
  const post = buildRankingPost({
    ...base,
    rows: [row(1, "a", "가", { delta: 5 })],
  })!;
  assert.equal(post.payload.story, "지난주 6위 → 1위");
  assert.match(post.body, /2026년 38주차 .*지난주 6위 → 1위입니다/);
});

test("4계단은 붙이지 않는다 — 매주 같은 말을 하게 된다", () => {
  const post = buildRankingPost({ ...base, rows: [row(1, "a", "가", { delta: 4 })] })!;
  assert.equal(post.payload.story, null);
});

test("신규 진입이 상승보다 우선한다", () => {
  const post = buildRankingPost({
    ...base,
    rows: [row(1, "a", "가", { delta: null, isNew: true })],
  })!;
  assert.equal(post.payload.story, "이번 주 새로 진입");
});

test("3주 연속이면 붙고 2주면 안 붙는다", () => {
  const three = buildRankingPost({
    ...base,
    rows: [row(1, "a", "가")],
    recentLeaders: ["a", "a", "b"],
  })!;
  assert.equal(three.payload.story, "3주 연속 1위");

  const two = buildRankingPost({
    ...base,
    rows: [row(1, "a", "가")],
    recentLeaders: ["a", "b"],
  })!;
  assert.equal(two.payload.story, null);
});

test("이름 비공개 선수는 발행 전에 빠지고 다음 사람이 1위가 된다", () => {
  const post = buildRankingPost({
    ...base,
    rows: [row(1, "a", "가"), row(2, "b", "나"), row(3, "c", "다")],
    suppressed: new Set(["a"]),
  })!;
  assert.equal(post.payload.leader.name, "나");
  // 원래 순위는 유지한다 — 2위가 1위로 둔갑하면 데이터가 거짓말이 된다
  assert.equal(post.payload.leader.rank, 2);
  assert.equal(post.payload.runnersUp.some((r) => r.playerKey === "a"), false);
});

test("전원 비공개면 포스트를 만들지 않는다", () => {
  const post = buildRankingPost({
    ...base,
    rows: [row(1, "a", "가")],
    suppressed: new Set(["a"]),
  });
  assert.equal(post, null);
});
