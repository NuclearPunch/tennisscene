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

test("1위와 2~4위를 담는다", () => {
  const post = buildRankingPost({
    ...base,
    rows: [row(1, "a", "가"), row(2, "b", "나"), row(3, "c", "다"), row(4, "d", "라"), row(5, "e", "마")],
  })!;
  assert.equal(post.payload.leader.name, "가");
  assert.deepEqual(post.payload.runnersUp.map((r) => r.name), ["나", "다", "라"]);
  assert.equal(post.body, "2026 W38 오픈부 1위는 가 선수입니다.");
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
  assert.match(post.body, /지난주 6위 → 1위입니다/);
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
