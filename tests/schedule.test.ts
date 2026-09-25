import assert from "node:assert/strict";
import { test } from "node:test";
import { interleave, slots, windowEnd } from "../src/lib/jobs/schedule";

/** 같은 글자가 연속으로 붙은 최대 길이 */
const maxRun = (s: string) => Math.max(...(s.match(/(.)\1*/g) ?? [""]).map((r) => r.length));

test("같은 종류가 붙지 않게 고르게 편다 — 피드 맨 위(끝)에 몰리지 않는다", () => {
  // 실제로 있었던 모양: 영상 15, AI 글 5. 예전 방식은 영상 10개가 끝(피드 꼭대기)에 몰렸다.
  const out = interleave([..."VVVVVVVVVVVVVVV", ..."AAAAA"], (x) => x).join("");
  assert.equal(out.length, 20);
  assert.ok(maxRun(out) <= 3, out);
  // 끝 다섯 개 안에도 AI 글이 있다
  assert.match(out.slice(-5), /A/, out);
  assert.match(out.slice(0, 5), /A/, out);
});

test("영상·결과·일정·AI 가 섞인 날", () => {
  const out = interleave([..."VVVVVVVVVV", ..."SSS", "T", ..."AAA"], (x) => x).join("");
  assert.equal(out.length, 17);
  assert.ok(maxRun(out) <= 3, out);
});

test("AI 글은 한 무리로 펴되 같은 계정이 연달아 나오지 않는다", () => {
  const items = [
    ...Array.from({ length: 6 }, (_, i) => ({ g: "video", a: "m", n: `v${i}` })),
    { g: "ai", a: "talk", n: "t1" }, { g: "ai", a: "talk", n: "t2" },
    { g: "ai", a: "today", n: "d1" }, { g: "ai", a: "court", n: "c1" },
  ];
  const out = interleave(items, (x) => x.g, (x) => x.a);
  const ai = out.filter((x) => x.g === "ai").map((x) => x.a);
  for (let i = 1; i < ai.length; i++) assert.notEqual(ai[i], ai[i - 1], ai.join(","));
  // AI 글끼리 바로 붙지 않는다
  const seq = out.map((x) => (x.g === "ai" ? "A" : "V")).join("");
  assert.doesNotMatch(seq, /AA/, seq);
});

test("종류가 골고루면 하나도 안 붙는다", () => {
  const out = interleave([..."VVVSSSTTTAAA"], (x) => x).join("");
  assert.equal(maxRun(out), 1, out);
});

test("무리 안의 순서는 그대로 둔다 — 8강·4강·결승이 뒤집히지 않게", () => {
  const items = [
    { g: "v", n: "8강" }, { g: "s", n: "결과1" }, { g: "v", n: "4강" }, { g: "v", n: "결승" },
  ];
  const vids = interleave(items, (x) => x.g).filter((x) => x.g === "v").map((x) => x.n);
  assert.deepEqual(vids, ["8강", "4강", "결승"]);
});

test("시각은 창 안에서 오름차순이고, 첫 글도 바로 뜨지 않는다", () => {
  const start = new Date("2026-09-26T00:00:00Z"); // 09:00 KST
  const end = new Date("2026-09-26T13:00:00Z"); // 22:00 KST
  const t = slots(12, start, end, () => 0.5);
  assert.equal(t.length, 12);
  assert.ok(t[0] > start);
  assert.ok(t[t.length - 1] < end);
  for (let i = 1; i < t.length; i++) assert.ok(t[i] > t[i - 1]);
  // 흔들어도 칸을 넘지 않아서 순서가 안 바뀐다
  const r = slots(12, start, end, () => 0.999);
  const l = slots(12, start, end, () => 0);
  for (let i = 1; i < 12; i++) assert.ok(l[i] > r[i - 1]);
});

test("밤 10시(KST)까지 나누고, 이미 늦었으면 3시간을 쓴다", () => {
  assert.equal(windowEnd(new Date("2026-09-26T00:00:00Z")).toISOString(), "2026-09-26T13:00:00.000Z");
  // 21:00 KST 에 손으로 돌렸다 → 22시까지 1시간뿐이라 3시간으로 늘린다
  assert.equal(windowEnd(new Date("2026-09-26T12:00:00Z")).toISOString(), "2026-09-26T15:00:00.000Z");
});
