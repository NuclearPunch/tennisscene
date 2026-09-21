import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { parseDuration, parseTitle } from "../src/lib/sources/youtube";

const UPLOADS = JSON.parse(
  readFileSync("tests/fixtures/youtube-uploads.json", "utf-8"),
) as Record<string, { items: { snippet: { title: string } }[] }>;

const titles = Object.values(UPLOADS).flatMap((c) => c.items.map((i) => i.snippet.title));

test("잘 정리된 제목에서 셋을 다 뽑는다", () => {
  assert.deepEqual(
    parseTitle("2024 이투데이오픈 마스터스부 결승(안병건 박신우 VS 전윤식 장준원)Amateur Tennis Match"),
    { tournamentName: "이투데이오픈", division: "마스터스부", round: "결승" },
  );
  assert.deepEqual(parseTitle("[ 국화부 16강 ]"), {
    tournamentName: null,
    division: "국화부",
    round: "16강",
  });
});

test("부서는 라운드와 붙어 있거나 대괄호 안일 때만 믿는다", () => {
  // 홍보형 제목에는 상대 선수의 배경으로 부서가 나온다. 그 경기의 부서가 아니다.
  const p = parseTitle(
    "2026 815신공회장배🔥 KATO랭킹 1위 클라스 vs 지도자부 우승 유성운! 16강 빅매치 #테니스",
  );
  assert.equal(p.division, null);
  assert.equal(p.tournamentName, "815신공회장배");
  assert.equal(p.round, "16강");

  assert.equal(parseTitle("베테랑부 우승 페어! 최한민·박성율 vs 김기환·나영성 16강").division, null);
  // 대괄호 안이면 믿는다
  assert.equal(parseTitle("2024 제21회 서귀포칠십리배 전국동호인테니스대회 [챌린저부]").division, "챌린저부");
});

test("부서가 아닌 '2부' 를 부서로 오인하지 않는다", () => {
  const p = parseTitle("2024 KATO랭킹시상식 2부 (2025.1.15)");
  assert.equal(p.division, null);
});

test("연도 오타는 떼고 이름 속 숫자는 지킨다", () => {
  // 채널 오타: "026 안성시 LTC배"
  assert.equal(parseTitle("026 안성시 LTC배 전국 동호인 테니스대회").tournamentName, "안성시 LTC배");
  // 8·15 는 이름의 일부다
  assert.equal(parseTitle("2026 815신공회장배 준결승").tournamentName, "815신공회장배");
});

test("해시태그와 이모지를 걷어낸다", () => {
  const p = parseTitle("2026 KATA 파티온배🔥 용철 vs 용철?! 예선 빅매치 #테니스 #tennis");
  assert.equal(p.tournamentName, "KATA 파티온배");
  assert.equal(p.round, "예선");
});

test("대회 영상이 아니면 아무것도 안 만든다", () => {
  assert.deepEqual(parseTitle("도대체 몇 번을 살리는 거야?! 끝까지 버텨 만든 극적인 1포인트 #테니스"), {
    tournamentName: null,
    division: null,
    round: null,
  });
  assert.deepEqual(parseTitle("주니어 장학금 전달 및 시상식"), {
    tournamentName: null,
    division: null,
    round: null,
  });
});

test("실제 제목 75건에서 터지지 않는다", () => {
  assert.ok(titles.length >= 70, `표본이 ${titles.length}건뿐이다`);
  let division = 0;
  let tournament = 0;
  for (const t of titles) {
    const p = parseTitle(t);
    // 뽑았다면 형태가 맞아야 한다
    if (p.division) {
      division++;
      assert.match(p.division, /부$/);
    }
    if (p.tournamentName) {
      tournament++;
      assert.ok(p.tournamentName.length <= 20, `너무 긴 대회명: ${p.tournamentName}`);
      // 이름 속 숫자(815신공회장배)는 괜찮다. 연도가 통째로 남는 것만 막는다.
      assert.doesNotMatch(p.tournamentName, /^\d{4}\s/, `연도가 남았다: ${p.tournamentName}`);
    }
  }
  // 조각난 제목이 많아 전부는 못 뽑는다. 절반쯤은 건져야 쓸모가 있다.
  assert.ok(tournament >= 30, `대회명 ${tournament}건뿐`);
  assert.ok(division >= 20, `부서 ${division}건뿐`);
});

test("재생시간을 초로 바꾼다", () => {
  assert.equal(parseDuration("PT1H2M3S"), 3723);
  assert.equal(parseDuration("PT45S"), 45);
  assert.equal(parseDuration("PT12M"), 720);
  assert.equal(parseDuration(undefined), null);
  assert.equal(parseDuration("이상한값"), null);
});
