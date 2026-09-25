import assert from "node:assert/strict";
import { test } from "node:test";
import { interleave, slots, windowEnd } from "../src/lib/jobs/schedule";

/** 같은 글자가 연속으로 붙은 최대 길이 */
const maxRun = (s: string) => Math.max(...(s.match(/(.)\1*/g) ?? [""]).map((r) => r.length));

test("같은 종류가 붙지 않게 번갈아 세운다", () => {
  // 실제로 있었던 모양: 영상 10, 결과 3, 일정 1, AI 글 3
  const items = [..."VVVVVVVVVV", ..."SSS", "T", ..."ABC"];
  const out = interleave(items, (x) => x).join("");
  assert.equal(out.length, items.length);
  // 영상이 절반 넘게 많아서 끝에 영상끼리 붙는 건 어쩔 수 없다. 그래도 34 연속 같은 일은 없다.
  assert.ok(maxRun(out) <= 3, out);
  // 앞쪽은 완전히 섞여 있다
  assert.equal(maxRun(out.slice(0, 14)), 1, out);
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
