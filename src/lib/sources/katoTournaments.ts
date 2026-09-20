import { parse as parseHtml } from "node-html-parser";
import { SourceStructureError } from "./types";

/**
 * 카토 대회 일정.
 *
 * 목록(`/openList`)은 구조가 단단해서 엄격하게 검증한다.
 * 상세(`/openGame/{id}`)의 요강은 자유 텍스트라 취약하다 — 부서별 일정표만
 * 구조화돼 있어 그것만 읽고, 나머지는 없으면 없는 대로 둔다.
 * 상세 파싱이 실패해도 목록은 살아야 한다.
 */
const BASE_URL = process.env.KATO_BASE_URL ?? "https://kato.kr";

/** 목록 페이지의 상태 클래스. 화면 텍스트가 아니라 클래스로 잡는다. */
const STATUS_BY_CLASS = {
  comblue: "open",
  comdefault: "upcoming",
  comgray: "closed",
} as const;

export type TournamentStatus = (typeof STATUS_BY_CLASS)[keyof typeof STATUS_BY_CLASS];

export type TournamentStub = {
  sourceId: string;
  name: string;
  /** 그룹 등급 (GM·MA·1~4그룹). 이미지 파일명에서 뽑는다. */
  grade: string | null;
  divisions: string[];
  startDate: string;
  endDate: string;
  status: TournamentStatus;
};

/** 상세의 부서별 일정. 목록에 없는 장소가 여기 있다. */
export type DivisionSchedule = {
  division: string;
  /** `2026년 09월 17일 (목) 09:00` 원문 그대로. 형식이 흔들려서 파싱하지 않는다. */
  when: string | null;
  venue: string | null;
  /** `접수중` `접수마감` 등 원문 */
  registration: string | null;
};

export type TournamentDetail = {
  sourceId: string;
  venue: string | null;
  schedules: DivisionSchedule[];
};

const MIN_ROWS = 10;

function clean(t: string | undefined): string | null {
  const v = t?.replace(/\s+/g, " ").trim();
  return v ? v : null;
}

/** `2026.02.27 ~ 2026.03.01` → `["2026-02-27", "2026-03-01"]` */
function parseRange(text: string): [string, string] | null {
  const m = text.match(
    /(\d{4})\.(\d{2})\.(\d{2})\s*~\s*(\d{4})\.(\d{2})\.(\d{2})/,
  );
  if (!m) return null;
  return [`${m[1]}-${m[2]}-${m[3]}`, `${m[4]}-${m[5]}-${m[6]}`];
}

export const katoTournaments = {
  org: "kato",

  async fetchList(): Promise<string> {
    const res = await fetch(`${BASE_URL}/openList`, {
      headers: {
        "User-Agent":
          "TennisSceneBot/0.1 (+https://tennisscene.kr/about/bot) tournaments-weekly",
        "Accept-Language": "ko-KR,ko;q=0.9",
      },
    });
    if (!res.ok) {
      throw new SourceStructureError(
        `/openList 가 ${res.status} ${res.statusText} 를 반환했다`,
        "kato",
      );
    }
    return res.text();
  },

  async fetchDetail(sourceId: string): Promise<string> {
    const res = await fetch(`${BASE_URL}/openGame/${sourceId}`, {
      headers: {
        "User-Agent":
          "TennisSceneBot/0.1 (+https://tennisscene.kr/about/bot) tournaments-weekly",
        "Accept-Language": "ko-KR,ko;q=0.9",
      },
    });
    if (!res.ok) {
      throw new SourceStructureError(
        `/openGame/${sourceId} 가 ${res.status} 를 반환했다`,
        "kato",
      );
    }
    return res.text();
  },

  /** 목록. 구조가 변하면 던진다 — 대회를 빠뜨리면 마감을 놓친다. */
  parseList(raw: string): TournamentStub[] {
    const root = parseHtml(raw);
    const rows = root.querySelectorAll("tr");
    const out: TournamentStub[] = [];

    for (const tr of rows) {
      const anchor = tr.querySelector("div.title a.content-title");
      if (!anchor) continue; // 헤더 등

      const sourceId = anchor
        .getAttribute("href")
        ?.match(/\/openGame\/(\d+)/)?.[1];
      const name = clean(anchor.text);
      const range = parseRange(tr.querySelector("div.date")?.text ?? "");

      if (!sourceId || !name || !range) {
        throw new SourceStructureError(
          `대회 행을 읽지 못했다 (id=${sourceId}, name=${name}, range=${range})`,
          "kato",
        );
      }

      const statusEl = tr.querySelector(
        "td.part-sector span[class^='com']",
      );
      const statusClass = statusEl?.classNames.split(/\s+/)[0] ?? "";
      const status =
        STATUS_BY_CLASS[statusClass as keyof typeof STATUS_BY_CLASS];
      if (!status) {
        throw new SourceStructureError(
          `모르는 대회 상태 클래스다: "${statusClass}" (${name})`,
          "kato",
        );
      }

      const gradeImg = tr
        .querySelector("td.group-sector img")
        ?.getAttribute("src");

      out.push({
        sourceId,
        name,
        grade: gradeImg?.match(/([a-zA-Z0-9]+)_\d+\.png/)?.[1] ?? null,
        divisions:
          clean(tr.querySelector("span.parts")?.text)
            ?.split(",")
            .map((d) => d.trim())
            .filter(Boolean) ?? [],
        startDate: range[0],
        endDate: range[1],
        status,
      });
    }

    if (out.length < MIN_ROWS) {
      throw new SourceStructureError(
        `대회가 ${out.length}개뿐이다 (최소 ${MIN_ROWS})`,
        "kato",
      );
    }
    return out;
  },

  /**
   * 상세. **던지지 않는다.**
   * 요강이 자유 텍스트라 언제든 모양이 바뀐다. 목록만으로도 카드는 성립하므로
   * 여기서 실패하면 빈 값을 주고 넘어간다.
   */
  parseDetail(raw: string, sourceId: string): TournamentDetail {
    try {
      const root = parseHtml(raw);
      const schedules: DivisionSchedule[] = [];

      for (const tr of root.querySelectorAll("div.takepart table tr")) {
        const cells = tr.querySelectorAll("td");
        const division = clean(cells[0]?.text);
        if (!division) continue;

        const place = cells[1]?.querySelector("div.place");
        // 일시는 .place 앞의 div 다
        const when = clean(
          cells[1]?.querySelectorAll("div").find((d) => d !== place)?.text,
        );

        schedules.push({
          division,
          when,
          venue: clean(place?.text),
          registration: clean(cells[2]?.querySelector("a")?.text),
        });
      }

      return {
        sourceId,
        venue: schedules.find((s) => s.venue)?.venue ?? null,
        schedules,
      };
    } catch {
      return { sourceId, venue: null, schedules: [] };
    }
  },
};
