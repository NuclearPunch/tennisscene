import { STORY_MARKS } from "./publish/resultStory";
import type {
  AccountKind,
  PostType,
  RankingPayload,
  ResultPayload,
  TournamentPayload,
} from "./types";

/**
 * 봇 글 끝에 붙는 **댓글 유도 한 줄.**
 *
 * 봇 글 38건의 댓글이 전부 0 이다. 사실만 적어놓으면 읽고 지나간다 — 물어봐야 대답이 온다.
 *
 * **본문(payload)에 박지 않는다.** 문구 하나 고치려고 38건을 다시 쓰게 된다.
 * `timeLabel` 과 같다 — 저장은 원본 값, 표기는 조회 시점에 만든다(CLAUDE.md).
 *
 * **데이터를 보고 고른다.** 대회 하나에 부서가 다섯이면 같은 질문이 다섯 번 연달아 뜬다.
 * 그래서 해석 줄이 무슨 이야기를 골랐는지 읽어서 거기에 맞춘다.
 *
 * 되도록 **누구나 답할 수 있는 질문**을 고른다. "나가셨던 분 계신가요?" 는 그 대회에
 * 나간 사람만 답할 수 있어 풀이 좁다. 의견을 묻는 쪽이 첫 댓글을 끌어내기 쉽다.
 */

type Input = {
  type: PostType;
  payload: unknown;
  authorKind: AccountKind;
  commentCount: number;
};

/** `제 16 회 성남배 전국 동호인 테니스대회` → `성남배` — 못 줄이면 원문을 안 쓴다. */
function shortName(name: string | undefined): string | null {
  if (!name) return null;
  let s = name.replace(/\s+/g, " ").trim();
  s = s.replace(/^\d{4}\s*/, "").replace(/^제\s*\d+\s*회\s*/, "");
  const cut = ["전국", "여성", "동호인", "테니스대회"]
    .map((w) => s.indexOf(w))
    .filter((i) => i > 0);
  if (cut.length > 0) s = s.slice(0, Math.min(...cut));
  s = s.trim();
  // 너무 길면 질문이 아니라 제목이 된다.
  return s && s.length <= 14 ? s : null;
}

function resultPrompt(p: ResultPayload): string {
  const champion = p.champion?.players?.[0]?.name;
  const story = p.story ?? "";

  // 1. 흐름이 보이는 선수 — 아무나 의견을 낼 수 있다.
  if (champion && story.includes(STORY_MARKS.streak)) {
    return `${champion} 선수 요즘 기세, 어떻게 보세요?`;
  }
  if (champion && story.includes(STORY_MARKS.alsoWon)) {
    return `${champion} 선수, 다음 대회도 가져갈까요?`;
  }

  // 2. 순위가 곧 바뀐다 — 예상을 묻는다.
  if (p.pointsLine?.includes("반영되면")) {
    return "이번 결과로 순위가 어떻게 바뀔까요?";
  }

  // 3. 랭킹과 결과의 대비. 이변이었는지 아닌지가 곧 질문이다.
  if (story.includes(STORY_MARKS.topSeed)) {
    return "1위가 그대로 우승했네요. 이변을 기대하셨나요?";
  }
  const rank = Number(story.match(STORY_MARKS.rank)?.[1] ?? 0);
  if (rank >= 20) return `랭킹 ${rank}위의 우승, 예상하신 분 계셨나요?`;
  if (rank > 0 && champion) return `${champion} 선수, 1위까지 갈 수 있을까요?`;

  if (story.includes(STORY_MARKS.stepUp)) {
    return "지난 대회 아쉬움을 풀었네요. 다음은 어디일까요?";
  }

  // 4. 기댈 이야기가 없으면 대회를 짚어 묻는다. 대회명이 있으면 부서보다 구체적이다.
  const where = shortName(p.tournamentName);
  return where
    ? `${where} ${p.division} 나가셨던 분 계신가요?`
    : `${p.division} 나가셨던 분 계신가요? 어떤 경기였는지 궁금합니다.`;
}

export function commentPrompt(input: Input): string | null {
  // 유저 글에는 안 붙인다. 남의 글 밑에 서비스가 질문을 다는 건 남의 말에 끼어드는 것이다.
  if (input.authorKind !== "bot") return null;
  // 이미 대화가 시작됐으면 물러난다. 댓글이 있는데 "첫 댓글을 남겨보세요"는 이상하다.
  if (input.commentCount > 0) return null;

  switch (input.type) {
    case "result":
      return resultPrompt(input.payload as ResultPayload);

    case "tournament": {
      const p = input.payload as TournamentPayload;
      // 접수 중이면 같이 나갈 사람을 찾는 질문이 제일 쓸모 있다.
      if (p.status === "open") return "이 대회 신청하신 분 계신가요?";
      return "이 대회 가보신 분 계신가요? 코트 상태가 궁금합니다.";
    }

    case "ranking": {
      const p = input.payload as RankingPayload;
      const leader = p.leader?.name;
      if (leader && p.story?.includes("연속")) {
        return `${leader} 선수 1위, 언제까지 갈까요?`;
      }
      return leader
        ? `${p.division}부 1위 ${leader} 선수, 예상하셨나요?`
        : `이번 주 ${p.division}부 순위, 예상하셨나요?`;
    }

    // 나머지 타입은 수집 잡이 붙는 대로 여기에 더한다.
    default:
      return null;
  }
}
