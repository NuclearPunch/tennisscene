import { parse as parseHtml } from "node-html-parser";
import type { ResultPlayer, ResultTeam } from "@/lib/types";
import { SourceStructureError } from "./types";

/**
 * 카토 대회 결과.
 *
 * 대진표(`/qualifiedDraws/{대회}/{부서}`)를 긁지 않는다. 96KB 짜리 128강 브라켓에
 * 참가자 전원의 실명과 소속이 들어 있어 파싱도 어렵고 담을 이유도 없다.
 * 화면이 쓰는 `POST /resultPart` 가 같은 내용을 JSON 으로 준다.
 *
 * 우리가 가져가는 건 **시상대뿐이다 — 우승·준우승·공동 3위.**
 * 응답에는 8강·16강·32강도 들어오지만 담지 않는다. 뉴스가 되는 건 시상대이고,
 * 32강까지 재게시하면 그냥 남의 참가자 명단을 옮겨오는 게 된다.
 */
const BASE_URL = process.env.KATO_BASE_URL ?? "https://kato.kr";

const UA =
  "TennisSceneBot/0.1 (+https://tennisscene.kr/about/bot) results-daily";

/** 시상대까지만. 응답의 rank 8·16·32 는 버린다. */
const PODIUM_MAX_RANK = 3;

/** `/openGame/{id}` 본선대진 탭이 알려주는 부서 목록. */
export type DivisionPart = {
  division: string;
  /** 부서 코드. 200=개나리 210=국화 100=챌린저 110=마스터스 120=베테랑 300=혼복 … */
  partCode: string;
};

export type DivisionResult = {
  sourceId: string;
  partCode: string;
  division: string;
  champion: ResultTeam;
  /** 결승이 기권으로 끝나면 비어 있을 수 있다. */
  runnerUp: ResultTeam | null;
  /** 공동 3위. 보통 2팀. */
  semifinalists: ResultTeam[];
};

function clean(t: string | null | undefined): string | null {
  const v = t?.replace(/\s+/g, " ").trim();
  return v ? v : null;
}

/** resultPart 응답 한 줄. 카토가 주는 이름 그대로. */
type RawRow = {
  rank?: number | string;
  type?: string;
  p1?: string;
  p1code?: string | number;
  club1?: string;
  p2?: string;
  p2code?: string | number;
  club2?: string;
};

type RawResult = {
  response?: number | string;
  ptype?: string;
  matchPart?: string;
  list?: RawRow[];
};

function toTeam(row: RawRow): ResultTeam | null {
  const players: ResultPlayer[] = [];
  for (const [name, code, club] of [
    [row.p1, row.p1code, row.club1],
    [row.p2, row.p2code, row.club2],
  ] as const) {
    const n = clean(name);
    if (!n) continue; // 단식이면 p2 가 비어 있다
    players.push({
      playerKey: code != null && `${code}` !== "" ? `${code}` : null,
      name: n,
      club: clean(club),
    });
  }
  return players.length > 0 ? { players } : null;
}

export const katoResults = {
  org: "kato",

  async fetchGame(sourceId: string): Promise<string> {
    const res = await fetch(`${BASE_URL}/openGame/${sourceId}`, {
      headers: { "User-Agent": UA, "Accept-Language": "ko-KR,ko;q=0.9" },
    });
    if (!res.ok) {
      throw new SourceStructureError(
        `/openGame/${sourceId} 가 ${res.status} 를 반환했다`,
        "kato",
      );
    }
    return res.text();
  },

  /**
   * 부서명 ↔ 부서 코드. **본선대진 탭의 링크에서 얻는다.**
   *
   * 목록 페이지의 `span.parts` 에도 부서명이 있지만 코드가 없다.
   * 코드를 상수 표로 박아두면 안 된다 — 혼합복식부·여자퓨처스부처럼
   * 대회마다 붙었다 빠지는 부서가 있고, 코드도 대회가 정한다.
   */
  parseParts(raw: string, sourceId: string): DivisionPart[] {
    const root = parseHtml(raw);
    const out: DivisionPart[] = [];

    for (const a of root.querySelectorAll("#tab4 a[href*='/qualifiedDraws/']")) {
      const partCode =
        a.getAttribute("data-part") ??
        a.getAttribute("href")?.match(/\/qualifiedDraws\/\d+\/(\d+)/)?.[1];
      const division = clean(a.text);
      if (!partCode || !division) continue;
      out.push({ division, partCode });
    }

    if (out.length === 0) {
      throw new SourceStructureError(
        `/openGame/${sourceId} 본선대진 탭에서 부서를 찾지 못했다`,
        "kato",
      );
    }
    return out;
  },

  /** 화면이 쓰는 그 엔드포인트. 파싱과 분리해야 픽스처로 테스트할 수 있다. */
  async fetchResult(sourceId: string, partCode: string): Promise<string> {
    const res = await fetch(`${BASE_URL}/resultPart`, {
      method: "POST",
      headers: {
        "User-Agent": UA,
        "Accept-Language": "ko-KR,ko;q=0.9",
        "Content-Type": "application/x-www-form-urlencoded",
        "X-Requested-With": "XMLHttpRequest",
      },
      body: new URLSearchParams({ code: sourceId, part: partCode, tab: "t4" }),
    });
    if (!res.ok) {
      throw new SourceStructureError(
        `/resultPart ${sourceId}/${partCode} 가 ${res.status} 를 반환했다`,
        "kato",
      );
    }
    return res.text();
  },

  /**
   * `null` 은 **아직 결과가 없다**는 뜻이다 (`response !== 1`). 실패가 아니다 —
   * 부서별로 끝나는 날이 다르고, 같은 대회 안에서도 사흘 차이가 난다.
   * 구조가 변한 것(결과는 있다는데 1위가 없는 것)은 던진다.
   */
  parseResult(
    raw: string,
    sourceId: string,
    partCode: string,
    fallbackDivision: string,
  ): DivisionResult | null {
    let data: RawResult;
    try {
      data = JSON.parse(raw) as RawResult;
    } catch {
      throw new SourceStructureError(
        `/resultPart ${sourceId}/${partCode} 가 JSON 이 아니다`,
        "kato",
      );
    }

    if (Number(data.response) !== 1) return null;

    const rows = (data.list ?? []).filter(
      (r) => Number(r.rank) <= PODIUM_MAX_RANK,
    );
    const byRank = (n: number) =>
      rows.filter((r) => Number(r.rank) === n).map(toTeam).filter(Boolean) as ResultTeam[];

    const champion = byRank(1)[0];
    if (!champion) {
      // response 가 1인데 우승이 없으면 응답 모양이 바뀐 것이다. 조용히 넘기면
      // 그날부터 결과 포스트가 통째로 사라지는데 아무도 모른다.
      throw new SourceStructureError(
        `/resultPart ${sourceId}/${partCode} 에 우승 행이 없다 (list ${data.list?.length ?? 0}행)`,
        "kato",
      );
    }

    return {
      sourceId,
      partCode,
      division: clean(data.ptype) ?? fallbackDivision,
      champion,
      runnerUp: byRank(2)[0] ?? null,
      semifinalists: byRank(3),
    };
  },

  /** 부서 대진표. 결과 포스트가 출처로 돌려주는 링크다. */
  drawUrl(sourceId: string, partCode: string): string {
    return `${BASE_URL}/qualifiedDraws/${sourceId}/${partCode}`;
  },
};
