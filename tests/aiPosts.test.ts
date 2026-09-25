import assert from "node:assert/strict";
import { test } from "node:test";
import { checkBody, parsePosts } from "../src/lib/jobs/aiPosts";
import { PERSONAS, systemPrompt } from "../src/lib/ai/personas";

const ok = (b: string, max = 250, recent: string[] = []) => checkBody(b, max, recent).ok;
const why = (b: string, max = 250) => {
  const r = checkBody(b, max, []);
  return r.ok ? "통과" : r.reason;
};

test("쓰레드처럼 짧은 질문 글은 통과한다", () => {
  assert.ok(ok("이번 주 성남배 마스터스부는 결승까지 전부 타이브레이크였네요. 여러분은 타이브레이크 들어가면 서브부터 바꾸시나요?"));
});

test("사람인 척하는 1인칭 경험담은 거른다", () => {
  assert.equal(why("제가 어제 동호회에서 쳐봤는데 이 스트링 진짜 좋더라고요. 다들 뭐 쓰세요?"), "1인칭 경험담이다");
  assert.equal(why("저희 클럽은 게임 순서를 이렇게 정하는데 여러분 클럽은 어떻게 하세요?"), "1인칭 경험담이다");
  assert.equal(why("요즘 저는 발리 연습을 많이 하는데요, 다들 어떤 연습 하시나요?"), "1인칭 경험담이다");
  // '제가' 가 단어 안에 들어간 건 괜찮다
  assert.ok(ok("복식에서 제공권을 잡으려면 전위가 먼저 움직여야 한다는 말, 다들 동의하시나요? 저마다 스타일이 다르던데요."));
});

test("링크·다른 계정 부르기·해시태그·마크다운은 거른다", () => {
  assert.equal(why("이번 주 대회 요강은 https://kato.kr 에서 확인하세요. 다들 나가시나요?"), "링크가 있다");
  assert.equal(why("@rank 계정에서 이번 주 랭킹이 떴네요. 예상하신 분 계세요?"), "다른 계정을 부른다");
  assert.equal(why("주말 대회 준비 다들 잘 되고 있나요? 컨디션 관리가 제일이죠 #테니스 #대회"), "해시태그가 있다");
  assert.equal(why("**서브 토스** 가 흔들리면 전부 흔들립니다. 토스 연습 따로 하시나요?"), "마크다운이 있다");
});

test("길이 제한은 계정마다 다르다 — 레슨 노트만 길게", () => {
  const long = "가".repeat(300);
  assert.equal(why(long, 250), "250자를 넘는다");
  assert.equal(why(long, 400), "통과");
  assert.equal(why("짧아요?"), "너무 짧다");
});

test("최근 글과 첫마디가 같으면 거른다", () => {
  const recent = ["주말 대회 준비 다들 잘 되고 있나요? 비 소식이 있던데요."];
  assert.equal(ok("주말 대회 준비 다들 잘 되고 있나요? 이번엔 컨디션 이야기를 해볼게요.", 250, recent), false);
});

test("응답에서 JSON 을 꺼낸다 — 코드 블록으로 감싸 와도", () => {
  assert.deepEqual(parsePosts('```json\n{"posts":[{"body":"가"},{"body":"나"}]}\n```'), ["가", "나"]);
  assert.deepEqual(parsePosts("죄송하지만 JSON 이 아닙니다"), []);
  assert.deepEqual(parsePosts('{"posts": 3'), []);
});

test("모든 AI 계정 프롬프트에 사람인 척 금지와 이름 금지가 들어 있다", () => {
  for (const p of PERSONAS) {
    const s = systemPrompt(p);
    assert.match(s, /사람인 척하지 않는다/);
    assert.match(s, /사람 이름을 쓰지 않는다/);
    assert.match(s, new RegExp(`${p.maxLength}자를 넘기지 않는다`));
  }
  // 요일마다 최소 두 계정은 쓴다 — 영상 사이에 끼워 넣을 글이 있어야 한다
  for (let d = 0; d < 7; d++) assert.ok(PERSONAS.filter((p) => p.days.includes(d)).length >= 2, `요일 ${d}`);
});
