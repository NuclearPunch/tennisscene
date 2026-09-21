import assert from "node:assert/strict";
import { test } from "node:test";
import {
  countChars,
  normalizeBody,
  POST_MAX,
  validatePostInput,
} from "../src/lib/postInput";

test("글자 수는 DB 의 char_length 처럼 코드 포인트로 센다", () => {
  // "🎾".length 는 2 다. 그대로 세면 화면은 통과인데 DB 가 거부하는 구간이 생긴다.
  assert.equal(countChars("🎾"), 1);
  assert.equal(countChars("테니스🎾"), 4);
});

test("앞뒤 공백과 줄 끝 공백을 걷는다", () => {
  assert.equal(normalizeBody("  오늘 첫 승  \n  \n"), "오늘 첫 승");
  assert.equal(normalizeBody("첫 줄   \n둘째 줄"), "첫 줄\n둘째 줄");
});

test("빈 줄은 하나까지만 남긴다 — 엔터 도배로 피드를 밀어내지 못한다", () => {
  assert.equal(normalizeBody("위\n\n\n\n\n아래"), "위\n\n아래");
  assert.equal(normalizeBody("위\r\n\r\n\r\n아래"), "위\n\n아래");
});

test("공백뿐인 글은 거부한다", () => {
  const r = validatePostInput({ body: "  \n\n  " });
  assert.equal(r.ok, false);
});

test("500자는 되고 501자는 안 된다", () => {
  assert.equal(validatePostInput({ body: "가".repeat(POST_MAX) }).ok, true);
  const over = validatePostInput({ body: "가".repeat(POST_MAX + 1) });
  assert.equal(over.ok, false);
  assert.match((over as { reason: string }).reason, /501자/);
});

test("글자 수는 다듬은 뒤에 센다", () => {
  // 뒤에 공백 100개가 붙어도 본문이 500자면 통과해야 한다.
  const r = validatePostInput({ body: "가".repeat(POST_MAX) + " ".repeat(100) });
  assert.equal(r.ok, true);
});

test("익명 여부는 진짜 boolean 만 받는다", () => {
  // "true" 가 섞여 들어와 뜻하지 않게 익명(또는 실명)으로 올라가면 안 된다.
  assert.equal(validatePostInput({ body: "글", isAnonymous: "true" }).ok, false);
  assert.equal(validatePostInput({ body: "글", isAnonymous: 1 }).ok, false);

  const anon = validatePostInput({ body: "글", isAnonymous: true });
  assert.deepEqual(anon, { ok: true, value: { body: "글", isAnonymous: true } });

  const named = validatePostInput({ body: "글" });
  assert.deepEqual(named, { ok: true, value: { body: "글", isAnonymous: false } });
});

test("형식이 깨진 요청을 거부한다", () => {
  assert.equal(validatePostInput(null).ok, false);
  assert.equal(validatePostInput("글").ok, false);
  assert.equal(validatePostInput({ body: 123 }).ok, false);
});
