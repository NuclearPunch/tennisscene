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

test("대괄호 안에 대회명이 들어가는 형식도 읽는다", () => {
  // KATA TENNIStube 형식. 대괄호를 통째로 버리면 대회명이 사라진다.
  assert.deepEqual(parseTitle("[2025 아식스컵 개나리부 결승] 권봉여/최순혜 vs. 정다정/최채영"), {
    tournamentName: "아식스컵",
    division: "개나리부",
    round: "결승",
  });
  // 공자테니스 형식 — 연도 뒤에 점이 붙고 부서는 괄호 안에 있다
  assert.deepEqual(
    parseTitle("[2026.제30회] 해남땅끝배 전남광주특별시 생활체육테니스대회 (일반부64강)"),
    { tournamentName: "해남땅끝배", division: "일반부", round: "64강" },
  );
});

test("채널마다 다른 철자를 받는다", () => {
  // 카토는 '마스터스부', 어택 덕스는 '마스터즈부' 로 쓴다.
  const p = parseTitle("KATO 안성시장배 마스터즈부 결승전! 김재원 강훈식(송도클레이) VS 이기원(후아유) 박인용(RnB)");
  assert.equal(p.tournamentName, "KATO 안성시장배");
  assert.equal(p.division, "마스터즈부");
  assert.equal(p.round, "결승");
  // 혼합복식은 '부' 없이 쓰는 채널이 있다
  assert.equal(parseTitle("[2025 아식스컵 혼합복식 결승] 홍지혜/손이수 vs. 유세은/김재원").division, "혼합복식부");
  // 다만 '부' 없는 다른 부서는 안 받는다 — "국화 4명의 승부" 같은 문장이 걸린다
  assert.equal(parseTitle("국화 4명의 승부!!! 권혜빈,김정숙 vs 김수정,성유미").division, null);
});

test("해시태그 속 부서는 검색용 태그지 경기 부서가 아니다", () => {
  // 야메테니스가 모든 쇼츠에 #오픈부 를 붙인다.
  const p = parseTitle("급할때 오뽜! #테니스 #tennis #테니스복식 #오픈부 #포핸드 #백핸드");
  assert.equal(p.division, null);
  assert.equal(p.tournamentName, null);
});

test("쇼츠는 제목이 경기 같아도 경기 영상이 아니다", async () => {
  const { isMatchVideo } = await import("../src/lib/jobs/youtube");
  // 실제로 28초짜리가 "결승 경기 영상" 으로 올라간 적이 있다.
  const final = parseTitle("동호인 테니스 마스터즈부 결승전! 앞뒤좌우 최선을 다하는 플레이");
  assert.equal(final.division, "마스터즈부");
  assert.equal(isMatchVideo(final, 28), false);
  assert.equal(isMatchVideo(final, 180), false); // 쇼츠 상한 3분까지는 쇼츠일 수 있다
  assert.equal(isMatchVideo(final, 498), true); // 올라간 경기 중 제일 짧은 것
});

test("길이를 모르면 올리지 않는다", async () => {
  const { isMatchVideo } = await import("../src/lib/jobs/youtube");
  // 그날 재생시간을 못 받았으면 다음 날 다시 받아서 판단한다.
  assert.equal(isMatchVideo(parseTitle("2026 파티온배 오픈부 결승"), null), false);
});

test("카타 채널 제목은 대회·부서·라운드가 다 나온다", () => {
  assert.deepEqual(parseTitle("2026 파티온배 오픈부 준결승2"), {
    tournamentName: "파티온배",
    division: "오픈부",
    round: "준결승2",
  });
  assert.deepEqual(parseTitle("2026 파티온배 신인부 결승"), {
    tournamentName: "파티온배",
    division: "신인부",
    round: "결승",
  });
});

test("관리자가 붙여넣는 채널 주소는 모양이 여러 가지다", async () => {
  const { parseChannelInput } = await import("../src/lib/sources/youtube");
  const handle = { kind: "handle", value: "@KATATENNIS" };
  const id = { kind: "id", value: "UCiTHNeO-ti75vj3QlFHclAA" };
  assert.deepEqual(parseChannelInput("https://www.youtube.com/@KATATENNIS"), handle);
  assert.deepEqual(parseChannelInput("youtube.com/@KATATENNIS/videos"), handle);
  assert.deepEqual(parseChannelInput("  @KATATENNIS "), handle);
  assert.deepEqual(parseChannelInput("https://www.youtube.com/channel/UCiTHNeO-ti75vj3QlFHclAA"), id);
  // 업로드 목록 ID 를 붙여넣어도 채널로 바꿔 찾는다
  assert.deepEqual(parseChannelInput("UUiTHNeO-ti75vj3QlFHclAA"), id);
  // 주소창에서 복사한 한글 핸들은 '@' 까지 인코딩돼 온다
  assert.deepEqual(
    parseChannelInput("https://www.youtube.com/%40%ED%85%8C%EB%8B%88%EC%8A%A4%EB%9D%BC%EC%9D%B4%EB%B8%8C"),
    { kind: "handle", value: "@테니스라이브" },
  );
  // 옛 주소는 API 로 못 찾는다. 모른다고 해야 화면이 "@주소를 붙여넣어 달라" 고 안내한다.
  assert.equal(parseChannelInput("https://www.youtube.com/c/oldstyle"), null);
  assert.equal(parseChannelInput("그냥 글자"), null);
});
