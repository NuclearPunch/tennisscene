/**
 * 카토 랭킹 포인트 배점 — 대회규정 4-11 「랭킹 그레이드」.
 *
 * 표는 규정 페이지(`/katoRules`)에 공개돼 있고, 실제 선수 기록
 * (`/careers/{id}` 의 POINTS 열)과 하나하나 맞춰 확인했다.
 * 예: 김재원 성남배(A그룹) 마스터스부 우승 160 · 안성시장배(2그룹) 우승 120 —
 * 아래 표의 값과 정확히 일치한다.
 *
 * **open / rest 를 틀리면 3배가 어긋난다.** 3그룹 우승이 open 이면 100점, rest 면 30점이다.
 * 규정은 open 을 "우승자 오픈 종목", rest 를 "우승자 출전불가 종목"이라고만 적어놔서
 * 어느 부서가 어디인지는 글만 봐서는 못 정한다. 그래서 실제 기록으로 확인했다:
 *   · 박제이 개나리부 우승(3그룹) → 30점 = 3 rest         → 개나리부 = rest
 *   · 조호선 챌린저부 공동3위(GM그룹) → 45점 = GM rest     → 챌린저부 = rest
 *   · 김재원 마스터스부 우승(A그룹) → 160점 = A open       → 마스터스부 = open
 *   · 정희윤 국화부 기록 8건 전부 open 표와 일치          → 국화부 = open
 *
 * 규정 4-9 가 그 이유를 말한다 — 개나리부·챌린저부 우승자는 상위 부서로 올라가므로
 * 그 부서에 다시 나올 수 없다. **모르는 부서는 점수를 말하지 않는다.**
 */

export type Podium = "우승" | "준우승" | "공동 3위";

/** 그룹 → [1위, 2위, 4강]. 8강 아래는 우리가 담지 않으므로 뺐다. */
const OPEN: Record<string, [number, number, number]> = {
  GM: [240, 180, 120],
  MA: [200, 140, 90],
  A: [160, 112, 72],
  "1": [140, 98, 63],
  "2": [120, 84, 54],
  "3": [100, 70, 45],
  "4": [20, 14, 9],
};

const REST: Record<string, [number, number, number]> = {
  GM: [100, 70, 45],
  MA: [80, 56, 36],
  A: [60, 42, 27],
  "1": [50, 35, 23],
  "2": [40, 28, 18],
  "3": [30, 21, 14],
};

/** 우승자가 다시 못 나오는 부서. 규정 4-9 + 실제 기록으로 확인. */
const REST_DIVISIONS = new Set(["개나리부", "챌린저부"]);
/** open 이 확인된 부서. 여기 없는 부서는 점수를 말하지 않는다. */
const OPEN_DIVISIONS = new Set(["국화부", "마스터스부", "베테랑부"]);

/**
 * 목록 페이지의 등급 이미지 파일명에서 온 값(`group1` `groupma`)을 표의 열쇠로.
 * 모르는 값이면 null — 억지로 맞추지 않는다.
 */
export function normalizeGrade(grade: string | null | undefined): string | null {
  if (!grade) return null;
  const g = grade.toLowerCase().replace(/^group/, "");
  if (g === "gm" || g === "ma" || g === "a") return g.toUpperCase();
  if (["1", "2", "3", "4"].includes(g)) return g;
  return null;
}

const INDEX: Record<Podium, 0 | 1 | 2> = { 우승: 0, 준우승: 1, "공동 3위": 2 };

/**
 * 이 성적으로 얻는 랭킹 포인트. **확신이 없으면 null 이다.**
 * 틀린 숫자를 사실처럼 적느니 아무 말도 안 하는 게 낫다.
 */
export function rankingPoints(input: {
  grade: string | null | undefined;
  division: string;
  place: Podium;
}): number | null {
  const grade = normalizeGrade(input.grade);
  if (!grade) return null;

  const rest = REST_DIVISIONS.has(input.division);
  if (!rest && !OPEN_DIVISIONS.has(input.division)) return null; // 모르는 부서
  // 4그룹은 rest 표가 없다. 지역대회라 open 한 줄뿐이다.
  const table = rest ? REST[grade] : OPEN[grade];
  if (!table) return null;

  return table[INDEX[input.place]];
}

/** 화면에 보이는 그룹 이름. `MA` → `MA그룹`, `1` → `1그룹` */
export function gradeLabel(grade: string | null | undefined): string | null {
  const g = normalizeGrade(grade);
  return g ? `${g}그룹` : null;
}
