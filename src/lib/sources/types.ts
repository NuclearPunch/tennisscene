import type { IsoTimestamp, IsoWeek } from "@/lib/types";

/**
 * 소스 중립 인터페이스.
 *
 * 2025년 12월 KTA–카토 랭킹운영시스템 통합 협약으로 kato.kr 의 URL 구조가
 * 통째로 이관될 수 있다(docs/DECISIONS.md). 파서를 URL 에 강결합시키면 그때 다 뜯어야 한다.
 * 수집 잡은 이 인터페이스만 보고, 소스별 차이는 어댑터가 삼킨다.
 */

export type ScrapedRankingRow = {
  /**
   * 부서명. **부서 코드가 아니라 탭 라벨이다.**
   * 카토의 `/playerView/{id}/{code}` 에 붙는 코드는 부서와 1:1 이 아니다 —
   * 챌린저 탭 안에 code 100·120 이 섞여 있고, 같은 선수가 다른 탭에서도 같은 코드를 쓴다.
   */
  division: string;
  /** 동순위가 흔하다. 유니크하지 않다. */
  rank: number;
  /** 소스의 선수 고유 키. 카토는 /careers/{id} 의 id. */
  playerKey: string;
  playerName: string;
  /** 복수 소속이 흔하다. 원문 그대로 둔다. */
  club: string | null;
  points: number | null;
  /** 최근 성적 한 줄. 카토의 blurb. */
  note: string | null;
};

export type RankingFetchResult = {
  org: string;
  week: IsoWeek;
  collectedAt: IsoTimestamp;
  rows: ScrapedRankingRow[];
};

export interface RankingSource {
  readonly org: string;
  /** 이 소스가 제공하는 부서명 */
  readonly divisions: readonly string[];
  /** 원문 HTML 을 가져온다. 파싱과 분리해야 픽스처로 테스트할 수 있다. */
  fetchRaw(): Promise<string>;
  /** 원문을 표준 행으로 바꾼다. 구조가 변했으면 던진다. */
  parse(raw: string, now?: Date): RankingFetchResult;
}

/**
 * 구조 변경·파싱 실패를 나타낸다.
 * 수집 잡은 이걸 받으면 **게시하지 않고** 운영 알림만 남긴다.
 * 잘못된 데이터를 피드에 올리는 것보다 그 주 포스트가 없는 게 낫다.
 */
export class SourceStructureError extends Error {
  constructor(
    message: string,
    readonly org: string,
  ) {
    super(message);
    this.name = "SourceStructureError";
  }
}
