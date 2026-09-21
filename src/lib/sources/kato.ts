import { parse as parseHtml } from "node-html-parser";
import { isoWeekOf } from "@/lib/week";
import {
  SourceStructureError,
  type RankingSource,
  type ScrapedRankingRow,
} from "./types";

/**
 * 카토 — (사)한국테니스발전협의회
 *
 * robots.txt 는 `Allow: /` 무제한이고 이용약관에 자동수집 금지 조항이 없다.
 * 공개 페이지가 부서별 상위 50명만 노출하므로 전수 수집이 필요 없다 —
 * 회원 ID 순회는 개인정보 대량수집이라 하지 않는다(docs/DECISIONS.md).
 *
 * URL 은 여기 한 곳에만 둔다. KTA 통합으로 이관되면 이 파일만 고친다.
 */
const BASE_URL = process.env.KATO_BASE_URL ?? "https://kato.kr";
const RANKING_PATH = "/ranking";

/** 탭 순서 = 테이블 순서. 화면에 보이는 라벨 그대로 쓴다. */
const DIVISIONS = ["개나리", "국화", "챌린저", "마스터스", "베테랑"] as const;

/** 페이지가 정상일 때의 모양. 벗어나면 구조가 바뀐 것으로 본다. */
const EXPECTED_TABLES = DIVISIONS.length;
const MIN_ROWS_PER_TABLE = 30;
const MIN_TOTAL_ROWS = 200;

function toNumber(text: string | undefined): number | null {
  if (!text) return null;
  const n = Number(text.replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function clean(text: string | undefined): string | null {
  const t = text?.replace(/\s+/g, " ").trim();
  return t ? t : null;
}

export const katoSource: RankingSource = {
  org: "kato",
  divisions: DIVISIONS,

  async fetchRaw() {
    const url = `${BASE_URL}${RANKING_PATH}`;
    const res = await fetch(url, {
      headers: {
        // 누가 긁는지 밝힌다. 차단당하면 차단당하는 게 맞다.
        "User-Agent":
          "TennisSceneBot/0.1 (+https://tennisscene.kr/about/bot) ranking-weekly",
        "Accept-Language": "ko-KR,ko;q=0.9",
      },
    });
    if (!res.ok) {
      throw new SourceStructureError(
        `${url} 가 ${res.status} ${res.statusText} 를 반환했다`,
        "kato",
      );
    }
    return res.text();
  },

  parse(raw, now = new Date()) {
    const root = parseHtml(raw);
    const tables = root.querySelectorAll("table.kato-ranking");

    if (tables.length !== EXPECTED_TABLES) {
      throw new SourceStructureError(
        `랭킹 테이블이 ${EXPECTED_TABLES}개여야 하는데 ${tables.length}개다. 페이지 구조가 바뀐 것으로 본다`,
        "kato",
      );
    }

    const rows: ScrapedRankingRow[] = [];

    tables.forEach((table, i) => {
      const division = DIVISIONS[i];
      const trs = table.querySelectorAll("tbody tr");

      if (trs.length < MIN_ROWS_PER_TABLE) {
        throw new SourceStructureError(
          `${division} 테이블의 행이 ${trs.length}개뿐이다 (최소 ${MIN_ROWS_PER_TABLE})`,
          "kato",
        );
      }

      for (const tr of trs) {
        const anchor = tr.querySelector("a.player-name");
        // `/playerView/{선수ID}/{부서코드}` — 뒤의 코드는 부서와 1:1 이 아니라 쓰지 않는다
        const playerKey = anchor
          ?.getAttribute("href")
          ?.match(/\/playerView\/(\d+)\//)?.[1];
        const playerName = clean(anchor?.text);
        const rank = toNumber(tr.querySelector("td.rank")?.text);

        // 하나라도 없으면 그 행만 버리지 않고 전체를 실패시킨다.
        // 조용히 빠진 행은 다음 주 변동 계산을 통째로 틀어놓는다.
        if (!playerKey || !playerName || rank === null) {
          throw new SourceStructureError(
            `${division} 테이블에서 행을 읽지 못했다 (rank=${rank}, key=${playerKey}, name=${playerName})`,
            "kato",
          );
        }

        rows.push({
          division,
          rank,
          playerKey,
          playerName,
          club: clean(tr.querySelector("div.club")?.text),
          points: toNumber(tr.querySelector("td.points")?.text),
          note: clean(tr.querySelector("div.blurb")?.text),
        });
      }
    });

    if (rows.length < MIN_TOTAL_ROWS) {
      throw new SourceStructureError(
        `전체 행이 ${rows.length}개뿐이다 (최소 ${MIN_TOTAL_ROWS})`,
        "kato",
      );
    }

    return {
      org: "kato",
      week: isoWeekOf(now),
      collectedAt: now.toISOString(),
      rows,
    };
  },
};
