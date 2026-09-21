import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildResultStory,
  shortTournament,
  whenLabel,
  type PodiumAppearance,
} from "../src/lib/publish/resultStory";
import type { ResultTeam } from "../src/lib/types";

const team = (...p: [string, string][]): ResultTeam => ({
  players: p.map(([playerKey, name]) => ({ playerKey, name, club: null })),
});

const past = (
  endsOn: string,
  tournamentName: string,
  place: PodiumAppearance["place"],
  division = "마스터스부",
): PodiumAppearance => ({ sourceId: endsOn, tournamentName, division, endsOn, place });

test("대회 이름에서 알맹이만 남긴다", () => {
  assert.equal(shortTournament("제 16 회 성남배 전국 동호인 테니스대회"), "성남배");
  assert.equal(shortTournament("2026 제3회 안성시장배 전국동호인테니스대회"), "안성시장배");
  assert.equal(shortTournament("제16회 공주 무령왕배 전국동호인테니스대회"), "공주 무령왕배");
  // '테니스' 만 자르면 '테니스협회장배' 가 함께 날아간다
  assert.equal(
    shortTournament("제 12 회 광주시 테니스협회장배 여성 동호인 전국 테니스대회"),
    "광주시 테니스협회장배",
  );
});

test("못 줄이는 이름은 원문 그대로 둔다 — 틀리게 자르느니 긴 게 낫다", () => {
  assert.equal(shortTournament("위닝컵"), "위닝컵");
});

test("몇 주 전인지 사람 말로 바꾼다", () => {
  assert.equal(whenLabel("2026-09-13", "2026-09-20"), "지난주");
  assert.equal(whenLabel("2026-09-06", "2026-09-20"), "2주 전");
  assert.equal(whenLabel("2026-08-30", "2026-09-20"), "3주 전");
  // 너무 오래됐거나 날짜가 없으면 아무 말도 안 한다
  assert.equal(whenLabel("2026-05-01", "2026-09-20"), "");
  assert.equal(whenLabel(null, "2026-09-20"), "");
});

test("직전 대회도 우승이면 그걸 말한다", () => {
  const story = buildResultStory({
    champion: team(["21843", "김재원"], ["9999", "김명종"]),
    division: "마스터스부",
    endsOn: "2026-09-06",
    history: new Map([["21843", [past("2026-08-30", "제 16 회 성남배 전국 동호인 테니스대회", "우승")]]]),
    ranks: new Map(),
  });
  assert.equal(story, "김재원 선수는 지난주 성남배에서도 정상에 올랐습니다.");
});

test("직전이 준우승이면 올라섰다고 말한다", () => {
  const story = buildResultStory({
    champion: team(["23828", "이기원"]),
    division: "마스터스부",
    endsOn: "2026-09-20",
    history: new Map([
      ["23828", [past("2026-09-06", "2026 제3회 안성시장배 전국동호인테니스대회", "준우승")]],
    ]),
    ranks: new Map(),
  });
  assert.equal(story, "이기원 선수는 2주 전 안성시장배 준우승에서 한 계단 올라섰습니다.");
});

test("세 번째 시상대가 가장 무겁다", () => {
  const story = buildResultStory({
    champion: team(["20509", "정희윤"]),
    division: "국화부",
    endsOn: "2026-09-20",
    history: new Map([
      [
        "20509",
        [
          past("2026-08-30", "제 16 회 성남배 전국 동호인 테니스대회", "공동 3위", "국화부"),
          past("2026-09-03", "제 12 회 광주시 테니스협회장배 여성 동호인 전국 테니스대회", "준우승", "국화부"),
        ],
      ],
    ]),
    // 랭킹이 있어도 이력이 이긴다
    ranks: new Map([["20509", { division: "국화", rank: 3, points: 100 }]]),
  });
  assert.equal(story, "정희윤 선수는 최근 3개 대회에서 모두 시상대에 올랐습니다.");
});

test("이력이 없으면 랭킹으로 간다", () => {
  const story = buildResultStory({
    champion: team(["21843", "김재원"]),
    division: "마스터스부",
    endsOn: "2026-09-06",
    history: new Map(),
    ranks: new Map([["21843", { division: "마스터스", rank: 5, points: 100 }]]),
  });
  assert.equal(story, "김재원 선수는 이번 주 마스터스부 랭킹 5위입니다.");
});

test("이 대회 뒤의 기록은 이야기에 쓰지 않는다", () => {
  // 우리가 대회를 최신순으로 수집하기 때문에 미래 기록이 먼저 들어와 있을 수 있다.
  const story = buildResultStory({
    champion: team(["21843", "김재원"]),
    division: "마스터스부",
    endsOn: "2026-08-30",
    history: new Map([["21843", [past("2026-09-06", "2026 제3회 안성시장배 전국동호인테니스대회", "우승")]]]),
    ranks: new Map(),
  });
  assert.equal(story, null);
});

test("선수는 언제나 '○○○ 선수' 로 부른다", () => {
  const make = (key: string, name: string) =>
    buildResultStory({
      champion: team([key, name]),
      division: "개나리부",
      endsOn: "2026-09-20",
      history: new Map(),
      ranks: new Map([[key, { division: "개나리", rank: 7, points: 100 }]]),
    });
  assert.match(make("1", "김재원")!, /^김재원 선수는 /);
  assert.match(make("2", "박제이")!, /^박제이 선수는 /);
  // 한글이 아니면 받침 없는 쪽으로 둔다
  assert.match(make("3", "리우유잉")!, /^리우유잉 선수는 /);
  assert.match(make("4", "SUN MINQING")!, /^SUN MINQING 선수는 /);
});

test("쓸 이야기가 없으면 아무 말도 만들지 않는다", () => {
  const story = buildResultStory({
    champion: team(["404", "이름"]),
    division: "여자퓨처스부",
    endsOn: "2026-09-13",
    history: new Map(),
    ranks: new Map(),
  });
  assert.equal(story, null);
});

test("다른 부서 랭킹이면 그렇다고 밝힌다", () => {
  // 밝히지 않으면 "국화부 우승 / 개나리부 1위" 로 읽혀 오해를 산다.
  const story = buildResultStory({
    champion: team(["30001", "장선희"]),
    division: "국화부",
    endsOn: "2026-09-03",
    history: new Map(),
    ranks: new Map([["30001", { division: "개나리", rank: 1, points: 100 }]]),
  });
  assert.equal(story, "장선희 선수는 개나리부 랭킹 1위로 국화부에 나섰습니다.");
});

test("같은 부서 1위가 우승하면 그걸 그대로 말한다", () => {
  const story = buildResultStory({
    champion: team(["30002", "박만재"]),
    division: "국화부",
    endsOn: "2026-08-30",
    history: new Map(),
    ranks: new Map([["30002", { division: "국화", rank: 1, points: 100 }]]),
  });
  assert.equal(story, "이번 주 국화부 랭킹 1위가 그대로 정상에 올랐습니다.");
});
