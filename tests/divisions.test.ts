import assert from "node:assert/strict";
import { test } from "node:test";
import { alsoSearched, expandDivision } from "../src/lib/divisions";

test("같은 부서는 이름이 달라도 같이 찾는다", () => {
  // 사용자가 알려준 대응: 오픈부 == 마스터스부, 신인부 == 챌린저부
  assert.deepEqual(expandDivision("오픈부"), ["오픈부", "마스터스부", "마스터즈부"]);
  assert.deepEqual(expandDivision("마스터스부"), ["오픈부", "마스터스부", "마스터즈부"]);
  assert.deepEqual(expandDivision("신인부"), ["신인부", "챌린저부", "챌린저스부"]);
});

test("철자가 갈린 것도 묶는다", () => {
  // 우리 데이터에 '마스터즈부' 영상 11건, '마스터스부' 결과 6건이 따로 있었다.
  assert.ok(expandDivision("마스터즈부").includes("마스터스부"));
  assert.ok(expandDivision("마스터스부").includes("마스터즈부"));
});

test("'부' 를 안 붙여도 묶이고, 붙인 대로 돌려준다", () => {
  // '부' 를 붙여 쳤으면 붙여서 넓힌다 — 대회 이름('KRC오픈')에 안 걸리게.
  assert.deepEqual(expandDivision("오픈"), ["오픈", "마스터스", "마스터즈"]);
  assert.ok(expandDivision("오픈부").every((t) => t.endsWith("부")));
});

test("부서 이름이 아니면 그대로 둔다", () => {
  assert.deepEqual(expandDivision("성남배"), ["성남배"]);
  assert.deepEqual(expandDivision("김재원"), ["김재원"]);
  // 모르는 부서는 묶지 않는다. 엉뚱한 글이 섞이는 게 못 찾는 것보다 나쁘다.
  assert.deepEqual(expandDivision("개나리부"), ["개나리부"]);
  assert.deepEqual(expandDivision("베테랑부"), ["베테랑부"]);
});

test("빈 검색어는 아무것도 안 만든다", () => {
  assert.deepEqual(expandDivision("   "), []);
});

test("같이 찾은 다른 이름만 따로 알려준다", () => {
  assert.deepEqual(alsoSearched("오픈부"), ["마스터스부", "마스터즈부"]);
  assert.deepEqual(alsoSearched("성남배"), []);
});
