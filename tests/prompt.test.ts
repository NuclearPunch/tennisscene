import assert from "node:assert/strict";
import { test } from "node:test";
import { commentPrompt } from "../src/lib/prompt";

const result = (over: Record<string, unknown> = {}) => ({
  type: "result" as const,
  authorKind: "bot" as const,
  commentCount: 0,
  payload: {
    division: "마스터스부",
    tournamentName: "제 16 회 성남배 전국 동호인 테니스대회",
    champion: { players: [{ playerKey: "1", name: "이기원", club: null }] },
    story: null,
    pointsLine: null,
    ...over,
  },
});

test("유저 글에는 안 붙인다", () => {
  // 남의 글 밑에 서비스가 질문을 다는 건 남의 말에 끼어드는 것이다.
  assert.equal(commentPrompt({ ...result(), authorKind: "user" }), null);
});

test("댓글이 이미 있으면 물러난다", () => {
  assert.equal(commentPrompt({ ...result(), commentCount: 1 }), null);
});

test("해석 줄이 고른 이야기를 이어받는다", () => {
  const q = (story: string) => commentPrompt(result({ story }));
  assert.equal(
    q("이기원 선수는 최근 3개 대회에서 모두 시상대에 올랐습니다."),
    "이기원 선수 요즘 기세, 어떻게 보세요?",
  );
  assert.equal(
    q("이기원 선수는 지난주 성남배에서도 정상에 올랐습니다."),
    "이기원 선수, 다음 대회도 가져갈까요?",
  );
  assert.equal(
    q("이번 주 국화부 랭킹 1위가 그대로 정상에 올랐습니다."),
    "1위가 그대로 우승했네요. 이변을 기대하셨나요?",
  );
  assert.equal(
    q("이기원 선수는 2주 전 안성시장배 준우승에서 한 계단 올라섰습니다."),
    "지난 대회 아쉬움을 풀었네요. 다음은 어디일까요?",
  );
});

test("순위가 낮은 선수의 우승은 이변으로 묻는다", () => {
  assert.equal(
    commentPrompt(result({ story: "성현아 선수는 이번 주 개나리부 랭킹 28위입니다." })),
    "랭킹 28위의 우승, 예상하신 분 계셨나요?",
  );
  // 상위권이면 반대로 1위를 넘볼 수 있는지 묻는다
  assert.equal(
    commentPrompt(result({ story: "이기원 선수는 이번 주 마스터스부 랭킹 5위입니다." })),
    "이기원 선수, 1위까지 갈 수 있을까요?",
  );
});

test("순위 변동 예고가 있으면 그걸 잇는다", () => {
  assert.equal(
    commentPrompt(result({ pointsLine: "1그룹 대회 우승으로 140점을 얻습니다. 반영되면 6위권이 됩니다." })),
    "이번 결과로 순위가 어떻게 바뀔까요?",
  );
});

test("기댈 이야기가 없으면 대회 이름을 짚는다", () => {
  // 대회 하나에 부서가 다섯이면 같은 질문이 다섯 번 뜬다. 대회명이 들어가야 갈린다.
  assert.equal(
    commentPrompt(result()),
    "성남배 마스터스부 나가셨던 분 계신가요?",
  );
  // 못 줄이는 긴 이름은 안 쓴다 — 질문이 제목이 된다
  assert.equal(
    commentPrompt(result({ tournamentName: "아주아주 긴 이름의 무언가가 들어간 대회" })),
    "마스터스부 나가셨던 분 계신가요? 어떤 경기였는지 궁금합니다.",
  );
});

test("접수 중인 대회는 같이 나갈 사람을 묻는다", () => {
  const base = { type: "tournament" as const, authorKind: "bot" as const, commentCount: 0 };
  assert.equal(commentPrompt({ ...base, payload: { status: "open" } }), "이 대회 신청하신 분 계신가요?");
  assert.match(commentPrompt({ ...base, payload: { status: "closed" } })!, /가보신 분/);
});

test("랭킹은 1위를 두고 묻는다", () => {
  const base = { type: "ranking" as const, authorKind: "bot" as const, commentCount: 0 };
  assert.equal(
    commentPrompt({ ...base, payload: { division: "챌린저", leader: { name: "김동현" }, story: "2주 연속 1위" } }),
    "김동현 선수 1위, 언제까지 갈까요?",
  );
  assert.equal(
    commentPrompt({ ...base, payload: { division: "챌린저", leader: { name: "김동현" }, story: null } }),
    "챌린저부 1위 김동현 선수, 예상하셨나요?",
  );
});

test("아직 붙이지 않은 타입은 조용하다", () => {
  assert.equal(
    commentPrompt({ type: "text", authorKind: "bot", commentCount: 0, payload: null }),
    null,
  );
});
