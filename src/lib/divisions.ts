/**
 * 부서 이름은 단체마다 다르고 채널마다 철자도 다르다.
 *
 * 같은 부서인데 이름이 달라서 못 찾는 일이 실제로 있다 —
 * 우리 데이터에 `마스터즈부` 영상이 11건, `마스터스부` 결과가 6건인데
 * 어느 쪽으로 검색해도 반쪽만 나왔다.
 *
 * **여기 적힌 것만 묶는다.** 모르는 대응을 넣으면 엉뚱한 글이 섞여 나오고,
 * 그건 못 찾는 것보다 나쁘다.
 */

/** 같은 부서로 묶이는 이름들. `부` 는 떼고 적는다. */
const GROUPS: readonly (readonly string[])[] = [
  // 남자 최상위. 카토는 마스터스, 생체·카타는 오픈. 어택 덕스 채널은 '마스터즈' 로 쓴다.
  ["오픈", "마스터스", "마스터즈"],
  // 남자 입문. 카토는 챌린저, 생체는 신인.
  ["신인", "챌린저", "챌린저스"],
];

/** `마스터스부` → `마스터스`. 붙었든 안 붙었든 같게 본다. */
function core(term: string): string {
  return term.trim().replace(/부$/, "");
}

/**
 * 검색어를 같은 뜻의 이름들로 넓힌다.
 *
 * **부서 이름 하나만 쳤을 때만 넓힌다.** "오픈" 이 대회 이름에도 들어가서
 * (`KATO 이카고 KRC오픈`, `레이디스오픈`) 아무 때나 넓히면 엉뚱한 글이 딸려 온다.
 *
 * 넓힐 게 없으면 원래 검색어 하나만 돌려준다.
 */
export function expandDivision(q: string): string[] {
  const key = core(q);
  if (!key) return [];

  const group = GROUPS.find((g) => g.includes(key));
  if (!group) return [q.trim()];

  // 사용자가 '부' 를 붙여 쳤으면 붙여서 넓힌다. 그래야 대회 이름에 안 걸린다.
  const suffix = q.trim().endsWith("부") ? "부" : "";
  return group.map((name) => `${name}${suffix}`);
}

/** 넓혀서 같이 찾은 다른 이름들. 화면에 "이것도 같이 찾았다" 고 알려줄 때 쓴다. */
export function alsoSearched(q: string): string[] {
  const all = expandDivision(q);
  return all.filter((t) => t !== q.trim());
}
