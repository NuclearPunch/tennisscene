/**
 * 글쓰기 입력 검증. 작성 화면과 저장 API 가 **같은 함수**를 쓴다.
 *
 * 화면만 검사하면 API 를 직접 두드려 뚫을 수 있고, API 만 검사하면 500자를 넘긴 걸
 * 게시를 누른 뒤에야 안다. 그래서 한 벌을 양쪽에서 돌린다. 마지막 방어선은 DB 의
 * `check (char_length(body) <= 500)` 이다.
 */

export const POST_MAX = 500;
/** 남은 글자가 이만큼 이하일 때부터 숫자를 보여준다. 처음부터 500 을 띄워두면 부담스럽다. */
export const COUNTER_FROM = 50;

/**
 * DB 의 char_length 와 같은 방식으로 센다 — 코드 포인트 단위다.
 * `"🎾".length` 는 2 지만 Postgres 는 1 로 센다. 어긋나면 화면은 통과인데 DB 가 거부한다.
 */
export function countChars(text: string): number {
  return Array.from(text).length;
}

/** 저장 직전에 다듬는다. 의미를 바꾸지 않는 선에서만. */
export function normalizeBody(raw: string): string {
  return raw
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+$/gm, "") // 줄 끝 공백
    .replace(/\n{3,}/g, "\n\n") // 빈 줄은 하나까지. 엔터 도배로 피드를 밀어내지 못하게
    .trim();
}

export type PostInput = { body: string; isAnonymous: boolean };

export type PostInputResult =
  | { ok: true; value: PostInput }
  | { ok: false; reason: string };

export function validatePostInput(input: unknown): PostInputResult {
  if (typeof input !== "object" || input === null) {
    return { ok: false, reason: "요청 형식이 올바르지 않습니다" };
  }
  const { body, isAnonymous } = input as Record<string, unknown>;

  if (typeof body !== "string") {
    return { ok: false, reason: "내용이 없습니다" };
  }
  // 익명 여부는 명시적인 true 만 받는다. "true" 나 1 이 섞여 들어와 뜻하지 않게
  // 실명으로(또는 익명으로) 올라가는 일이 없어야 한다.
  if (isAnonymous !== undefined && typeof isAnonymous !== "boolean") {
    return { ok: false, reason: "요청 형식이 올바르지 않습니다" };
  }

  const clean = normalizeBody(body);
  const n = countChars(clean);
  if (n === 0) return { ok: false, reason: "내용을 입력해주세요" };
  if (n > POST_MAX) {
    return { ok: false, reason: `${POST_MAX}자까지 쓸 수 있습니다 (지금 ${n}자)` };
  }

  return { ok: true, value: { body: clean, isAnonymous: isAnonymous === true } };
}
