import assert from "node:assert/strict";
import { test } from "node:test";
import {
  gradeLabel,
  normalizeGrade,
  rankingPoints,
} from "../src/lib/publish/rankingPoints";

test("실제 선수 기록과 맞는다 — open 부서", () => {
  // kato.kr/careers 의 POINTS 열에서 그대로 가져온 값이다.
  // 김재원 마스터스부
  assert.equal(rankingPoints({ grade: "groupA", division: "마스터스부", place: "우승" }), 160);
  assert.equal(rankingPoints({ grade: "group2", division: "마스터스부", place: "우승" }), 120);
  assert.equal(rankingPoints({ grade: "groupA", division: "마스터스부", place: "준우승" }), 112);
  assert.equal(rankingPoints({ grade: "group2", division: "마스터스부", place: "공동 3위" }), 54);
  // 정희윤 국화부
  assert.equal(rankingPoints({ grade: "group3", division: "국화부", place: "준우승" }), 70);
  assert.equal(rankingPoints({ grade: "groupGM", division: "국화부", place: "공동 3위" }), 120);
  assert.equal(rankingPoints({ grade: "group1", division: "국화부", place: "준우승" }), 98);
});

test("실제 선수 기록과 맞는다 — rest 부서", () => {
  // 여기가 틀리면 3배가 어긋난다. 박제이 개나리부 우승(3그룹) = 30점
  assert.equal(rankingPoints({ grade: "group3", division: "개나리부", place: "우승" }), 30);
  // 조호선 챌린저부 공동3위(GM그룹) = 45점. open 이면 120 이다.
  assert.equal(rankingPoints({ grade: "groupGM", division: "챌린저부", place: "공동 3위" }), 45);
});

test("모르는 부서는 점수를 말하지 않는다", () => {
  // 여자퓨처스부·혼합복식부·지도자부가 open 인지 rest 인지 확인된 바 없다.
  assert.equal(rankingPoints({ grade: "group1", division: "여자퓨처스부", place: "우승" }), null);
  assert.equal(rankingPoints({ grade: "group2", division: "혼합복식부", place: "우승" }), null);
});

test("모르는 등급도 말하지 않는다", () => {
  assert.equal(rankingPoints({ grade: null, division: "마스터스부", place: "우승" }), null);
  assert.equal(rankingPoints({ grade: "group9", division: "마스터스부", place: "우승" }), null);
  // 4그룹은 rest 표가 아예 없다
  assert.equal(rankingPoints({ grade: "group4", division: "개나리부", place: "우승" }), null);
  assert.equal(rankingPoints({ grade: "group4", division: "마스터스부", place: "우승" }), 20);
});

test("등급 표기", () => {
  assert.equal(normalizeGrade("groupma"), "MA");
  assert.equal(normalizeGrade("group1"), "1");
  assert.equal(gradeLabel("groupGM"), "GM그룹");
  assert.equal(gradeLabel("보이지않는값"), null);
});
