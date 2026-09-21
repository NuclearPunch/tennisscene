import type { ResultTeam } from "@/lib/types";
import { gradeLabel, rankingPoints, type Podium } from "./rankingPoints";

/**
 * 대회 결과 포스트에 붙는 **해석 한 줄**.
 *
 * "제16회 성남배 마스터스부, 김재원·김명종 조가 우승했습니다" 는 문장으로 옮긴 DB 행이다.
 * 사람이 읽을 이유를 만드는 건 그 뒤에 오는 한 줄이다 — 이 우승이 왜 이야기인가.
 *
 * **전부 우리가 가진 사실로만 만든다.** 남의 기사를 요약하지 않는다.
 * 우리는 랭킹 스냅샷과 대회 결과를 같은 `player_key` 로 잇고 있어서,
 * 이 이야기는 카토도 다른 서비스도 못 만든다.
 *
 * **없는 말은 안 한다.** 우리 수집은 2026-08-30 부터다. 그래서 "첫 우승" "올해 두 번째"
 * 같은 말은 쓰지 않는다 — 그 이전을 모르기 때문이다. 쓸 수 있는 건 "우리가 본 것"뿐이다.
 * 같은 이유로 "연속 우승"도 안 쓴다. 우리는 시상대만 보므로 그 사이 대회에서
 * 일찍 떨어졌는지 알 수 없다.
 */

export type Place = "우승" | "준우승" | "공동 3위";

/** 이 선수가 과거에 시상대에 오른 기록 한 건. */
export type PodiumAppearance = {
  sourceId: string;
  tournamentName: string;
  division: string;
  /** 대회 종료일. 순서를 정하고 "몇 주 전"을 계산하는 기준이다. */
  endsOn: string | null;
  place: Place;
};

export type PlayerRank = { division: string; rank: number; points: number | null };

/** 이 부서에서 이 점수면 몇 위가 되는지. 순위표를 훑어서 센다. */
export type RankAt = (division: string, points: number) => number | null;

/**
 * 선수 이름은 **항상 "○○○ 선수"** 로 부른다. 랭킹 포스트가 이미 그렇게 쓰고 있고
 * ("1위는 김동현 선수입니다"), 동호인 대회 기사의 말투이기도 하다.
 * 덤으로 조사 문제도 사라진다 — '선수' 는 받침이 없어 언제나 '는' 이다.
 */
function called(name: string): string {
  return `${name} 선수`;
}

/**
 * `제 16 회 성남배 전국 동호인 테니스대회` → `성남배`
 *
 * 대회 이름은 길고 앞뒤가 정형이다. 한 줄에 넣으려면 알맹이만 남겨야 한다.
 * 못 줄이면 원문을 그대로 쓴다 — 틀리게 자르느니 긴 게 낫다.
 */
export function shortTournament(name: string): string {
  let s = name.replace(/\s+/g, " ").trim();
  s = s.replace(/^\d{4}\s*/, ""); // 2026
  s = s.replace(/^제\s*\d+\s*회\s*/, ""); // 제 16 회
  // 여기서부터는 어느 대회에나 붙는 말이다. '테니스대회' 는 통째로만 자른다 —
  // '테니스' 만 자르면 '테니스협회장배' 가 함께 날아간다.
  const cut = ["전국", "여성", "동호인", "테니스대회"]
    .map((w) => s.indexOf(w))
    .filter((i) => i > 0);
  if (cut.length > 0) s = s.slice(0, Math.min(...cut));
  return s.trim() || name;
}

/** 두 날짜 사이를 사람 말로. 기준이 없으면 빈 문자열. */
export function whenLabel(from: string | null, to: string | null): string {
  if (!from || !to) return "";
  const days = Math.round(
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400_000,
  );
  if (!Number.isFinite(days) || days < 0) return "";
  if (days <= 9) return "지난주";
  const weeks = Math.round(days / 7);
  if (weeks <= 4) return `${weeks}주 전`;
  if (weeks <= 8) return "지난달";
  return "";
}

export type StoryInput = {
  champion: ResultTeam;
  /** 대회 등급(`group1` `groupma`). 포인트를 계산하는 열쇠다. */
  grade?: string | null;
  /** 이 대회가 이미 랭킹에 반영됐나. 반영 전일 때만 예상 순위를 말한다. */
  reflected?: boolean;
  /** 부서·점수 → 예상 순위 */
  rankAt?: RankAt;
  /** 이번 대회 부서. `마스터스부` 처럼 '부' 가 붙어 있다. */
  division: string;
  endsOn: string | null;
  /** 선수 키 → 이 대회 **이전**의 시상대 기록 (종료일 오름차순) */
  history: Map<string, PodiumAppearance[]>;
  /** 선수 키 → 이번 주 랭킹 */
  ranks: Map<string, PlayerRank>;
};

type Candidate = { weight: number; text: string };

/**
 * 한 줄을 고른다. 여러 이야기가 되면 **가장 무거운 것 하나만** 쓴다 —
 * 두 줄 이상 붙이면 다시 명세서가 된다.
 */
export function buildResultStory(input: StoryInput): string | null {
  const { champion, division, endsOn, history, ranks } = input;
  const candidates: Candidate[] = [];

  for (const player of champion.players) {
    if (!player.playerKey) continue;
    const past = (history.get(player.playerKey) ?? [])
      .filter((a) => a.endsOn && endsOn && a.endsOn < endsOn)
      .sort((a, b) => (a.endsOn ?? "").localeCompare(b.endsOn ?? ""));

    const name = player.name;
    const last = past.at(-1);

    if (last) {
      const when = whenLabel(last.endsOn, endsOn);
      const where = shortTournament(last.tournamentName);
      // 부서가 다르면 알려준다. 같으면 군더더기다.
      const at = last.division === division ? where : `${where} ${last.division}`;
      const lead = when ? `${when} ` : "";

      if (past.length >= 2) {
        // 세 번째 시상대. 흐름이 보이는 순간이라 가장 무겁다.
        candidates.push({
          weight: 4,
          text: `${called(name)}는 최근 ${past.length + 1}개 대회에서 모두 시상대에 올랐습니다.`,
        });
      } else if (last.place === "우승") {
        candidates.push({
          weight: 3,
          text: `${called(name)}는 ${lead}${at}에서도 정상에 올랐습니다.`,
        });
      } else {
        candidates.push({
          weight: 3,
          text: `${called(name)}는 ${lead}${at} ${last.place}에서 한 계단 올라섰습니다.`,
        });
      }
    }

    const rank = ranks.get(player.playerKey);
    if (rank) {
      // 랭킹 부서는 '부' 없이 저장돼 있다(마스터스). 표기할 때 붙인다.
      const rankDivision = `${rank.division}부`;

      if (rankDivision !== division) {
        // 다른 부서 랭킹이다. 밝히지 않으면 "국화부 우승 / 개나리부 1위" 처럼 읽혀 오해를 산다.
        // 밝히고 나면 오히려 이야기가 된다 — 다른 부서 상위권이 이 부서에 나와 이겼다.
        candidates.push({
          weight: 2,
          text: `${called(name)}는 ${rankDivision} 랭킹 ${rank.rank}위로 ${division}에 나섰습니다.`,
        });
      } else if (rank.rank === 1) {
        candidates.push({
          weight: 2,
          text: `이번 주 ${rankDivision} 랭킹 1위가 그대로 정상에 올랐습니다.`,
        });
      } else {
        candidates.push({
          weight: rank.rank <= 10 ? 2 : 1,
          text: `${called(name)}는 이번 주 ${rankDivision} 랭킹 ${rank.rank}위입니다.`,
        });
      }
    }
  }

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.weight - a.weight);
  return candidates[0].text;
}

/**
 * 포인트 한 줄. 해석과 **따로** 붙는다 — 하나는 이야기, 하나는 정보다.
 *
 * 아직 랭킹에 반영되기 전이면 예상 순위까지 말한다. 규정 4-10 이
 * "대회 종료 후 일주일 이내 업데이트" 라고 해서, 그 안에 든 대회는 반영 전으로 본다.
 * **이미 반영된 대회에 다시 더하면 두 번 세는 것이다.**
 *
 * 예상 순위는 추정이다 — 포인트가 1년 롤링이라 남의 점수도 같이 움직인다.
 * 그래서 '위' 가 아니라 '위권' 이라 쓰고, 이번 주 순위표 기준임을 밝힌다.
 */
export function buildPointsLine(input: StoryInput): string | null {
  const { champion, division, grade, ranks, rankAt, reflected } = input;
  const points = rankingPoints({ grade, division, place: "우승" as Podium });
  if (points === null) return null;

  const label = gradeLabel(grade);
  const lead = label ? `${label} 대회 ` : "";
  // 이미 반영된 대회는 지난 일이다. 현재형으로 쓰면 아직 안 받은 것처럼 읽힌다.
  if (reflected) return `${lead}우승으로 랭킹 포인트 ${points}점을 얻었습니다.`;

  const earned = `${lead}우승으로 랭킹 포인트 ${points}점을 얻습니다.`;

  // 예상 순위는 같은 부서 랭킹에 있는 선수에게만 말할 수 있다.
  for (const p of champion.players) {
    const rank = p.playerKey ? ranks.get(p.playerKey) : undefined;
    if (!rank || rank.points === null || !rankAt) continue;
    if (`${rank.division}부` !== division) continue; // 다른 부서 점수는 이 부서 순위를 못 만든다

    const next = rankAt(rank.division, rank.points + points);
    if (next === null || next >= rank.rank) continue; // 순위가 안 오르면 말할 게 없다

    return (
      `${earned} 반영되면 ${called(p.name)}는 ` +
      `${division} ${rank.rank}위에서 ${next}위권이 됩니다.`
    );
  }
  return earned;
}
