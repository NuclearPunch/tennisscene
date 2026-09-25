import assert from "node:assert/strict";
import { test } from "node:test";
import { hasBlockedWords } from "../src/lib/moderation";
import { validatePostInput } from "../src/lib/postInput";

test("욕설·비하·혐오 표현은 막는다", () => {
  for (const t of ["이 씨발 서브", "병신같이 치네", "개새끼야", "니애미", "틀딱들은 코트에서 나가라", "ㅅㅂ 졌다"]) {
    assert.equal(hasBlockedWords(t), true, t);
  }
});

test("글자 사이에 기호·숫자를 끼워도 잡는다", () => {
  for (const t of ["씨1발", "병.신", "개-새-끼", "시*발"]) assert.equal(hasBlockedWords(t), true, t);
});

test("테니스 글에서 흔한 말은 막지 않는다", () => {
  for (const t of [
    "미친 샷이네요", // 칭찬
    "더 들어갈 수 없는 미친 각",
    "여기가 시발점이었죠",
    "다시 발리 연습해야겠어요", // 띄어쓰기를 지우면 걸리는 말 — 그래서 띄어쓰기는 안 지운다
    "존나 힘들었다",
    "보지 마세요 이 영상",
    "병원 다녀왔어요",
    "개나리부 결승",
  ]) {
    assert.equal(hasBlockedWords(t), false, t);
  }
});

test("글쓰기·댓글 검증이 거른다", () => {
  const r = validatePostInput({ body: "이 병신아", isAnonymous: true });
  assert.equal(r.ok, false);
  assert.equal(validatePostInput({ body: "오늘 미친 샷 나왔다" }).ok, true);
});
