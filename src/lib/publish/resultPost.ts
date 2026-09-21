import type { ResultPayload, ResultTeam } from "@/lib/types";
import type { DivisionResult } from "@/lib/sources/katoResults";
import { katoResults } from "@/lib/sources/katoResults";
import {
  buildPointsLine,
  buildResultStory,
  type PlayerRank,
  type PodiumAppearance,
  type RankAt,
} from "./resultStory";

/**
 * 끝난 부서의 시상대를 포스트로. DB 를 모르는 순수 함수다.
 *
 * 랭킹 포스트가 "이번 주 1위가 누구인지"라면 이건 "이 대회 우승이 누구인지"다.
 * 둘 다 헤드라인이 한 줄이고 나머지는 딸려 오는 목록이라 카드 구조가 같다.
 */

export type BuiltResultPost = {
  payload: ResultPayload;
  body: string;
};

/** 복식 한 조는 붙여 쓴다. `조호선·최혁열` */
function teamNames(team: ResultTeam): string {
  return team.players.map((p) => p.name).join("·");
}

/** 팀에 이름 비공개 승인 선수가 한 명이라도 있으면 true. */
function isSuppressed(team: ResultTeam, suppressed: Set<string>): boolean {
  return team.players.some((p) => p.playerKey && suppressed.has(p.playerKey));
}

export function buildResultPost(input: {
  result: DivisionResult;
  tournamentName: string;
  /** 대회 종료일. 목록에서 온다. 못 맞추면 null. */
  endsOn?: string | null;
  org?: string;
  /** 이름 비공개가 승인된 선수 (suppressed_players) */
  suppressed?: Set<string>;
  /** 선수 키 → 지난 시상대 기록. 해석 한 줄을 만드는 재료다. */
  history?: Map<string, PodiumAppearance[]>;
  /** 선수 키 → 이번 주 랭킹 */
  ranks?: Map<string, PlayerRank>;
  /** 대회 등급(`group1` `groupma`). 랭킹 포인트를 계산하는 열쇠다. */
  grade?: string | null;
  /** 이 대회가 이미 랭킹에 반영됐나. 반영 전일 때만 예상 순위를 말한다. */
  reflected?: boolean;
  /** 부서·점수 → 예상 순위 */
  rankAt?: RankAt;
}): BuiltResultPost | null {
  const { result, tournamentName, endsOn = null, org = "kato" } = input;
  const suppressed = input.suppressed ?? new Set<string>();

  // 우승·준우승에 비공개 선수가 있으면 **포스트 자체를 만들지 않는다.**
  // 랭킹은 그 선수만 빼도 나머지 순위가 성립하지만, 시상대는 우승이 헤드라인이라
  // 가리면 남는 게 없다. "우승 ○○○" 은 안 쓴 것만 못하다.
  if (
    isSuppressed(result.champion, suppressed) ||
    (result.runnerUp && isSuppressed(result.runnerUp, suppressed))
  ) {
    return null;
  }

  // 공동 3위는 헤드라인이 아니라서 해당 팀만 빼고 간다.
  const semifinalists = result.semifinalists.filter(
    (t) => !isSuppressed(t, suppressed),
  );

  const storyInput = {
    champion: result.champion,
    division: result.division,
    endsOn,
    history: input.history ?? new Map(),
    ranks: input.ranks ?? new Map(),
    grade: input.grade,
    reflected: input.reflected,
    rankAt: input.rankAt,
  };
  const story = buildResultStory(storyInput);
  const pointsLine = buildPointsLine(storyInput);

  const payload: ResultPayload = {
    org,
    sourceId: result.sourceId,
    partCode: result.partCode,
    tournamentName,
    division: result.division,
    endsOn,
    champion: result.champion,
    runnerUp: result.runnerUp,
    semifinalists,
    story,
    pointsLine,
    grade: input.grade ?? null,
    sourceUrl: katoResults.drawUrl(result.sourceId, result.partCode),
  };

  // 단식이면 "조"가 아니라 "선수"다. 카토는 지금 전 부서 복식이지만
  // 단식 부서가 생겼을 때 문장이 이상해지는 건 막아둔다.
  const unit = result.champion.players.length > 1 ? "조" : "선수";
  // 해석은 줄을 바꿔 붙인다. 한 문장에 이어 붙이면 둘 다 흐려진다.
  const body =
    `${tournamentName} ${result.division}, ` +
    `${teamNames(result.champion)} ${unit}가 우승했습니다.` +
    [story, pointsLine].filter(Boolean).map((l) => `\n${l}`).join("");

  return { payload, body };
}
