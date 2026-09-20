# 로드맵

한 줄 = 한 태스크 = 서브에이전트 하나. 프롬프트에 **태스크 ID**를 넣어서 부른다.
파일 범위가 안 겹치는 것만 동시에 돌린다 (`AGENTS.md` 소유권 표 참조).

상태: `todo` / `doing` / `done` / `blocked`

---

## Phase 0 — 기반 · 순차

같은 계약을 만지므로 **하나씩** 한다.

| ID | 담당 | 할 일 | 파일 범위 | 선행 | 완료 기준 | 상태 |
|---|---|---|---|---|---|---|
| B-0.1 | backend | Supabase 스키마 (`accounts` `posts` `ranking_snapshots` `tournaments` `videos` `likes` `reposts` `follows`) | `supabase/**` | — | 마이그레이션이 로컬에서 적용되고 시드 계정 6개(봇)가 들어간다 | **done** |
| B-0.2 | backend | `types.ts` 를 스키마와 맞춘다. 불일치 제거 | `src/lib/types.ts` | B-0.1 | `tsc --noEmit` 깨끗 + 기존 mock 이 새 타입으로 통과 | **done** |

| B-0.3 | backend | 코드 리뷰 지적사항 수정 (카운터 트리거 권한, 차단/익명, auth 삭제, 억제 경로 등 11건) | `supabase/**` `src/lib/**` | B-0.2 | PG17 에서 재현 테스트 전부 통과 | **done** |

---

## Phase 1 — 수집 파이프라인 · 1.1~1.5 병렬 가능

**B-1.1 / B-1.3 / B-1.4 / B-1.5 는 파일이 안 겹치므로 동시에 돌려도 된다.**
B-1.2 와 B-1.6 은 앞의 결과를 먹으므로 순차.

| ID | 담당 | 할 일 | 파일 범위 | 선행 | 완료 기준 | 상태 |
|---|---|---|---|---|---|---|
| B-1.1 | backend | 카토 랭킹 스크래퍼 + 소스 어댑터 계층 | `scripts/sources/kato.ts` `src/lib/sources/**` | B-0.2 | 부서 5개 상위 50명이 내부 형태로 파싱되고, URL 구조를 어댑터가 감싼다 | **done** |
| B-1.3 | backend | 카토 대회 목록·요강 스크래퍼 | `scripts/sources/kato-tour.ts` | B-0.2 | 대회명·장소·기간·마감일·부서가 구조화되어 나온다 | todo |
| B-1.4 | backend | 유튜브 수집 (`channels.list` 1회 캐시 → `playlistItems.list` 순회) | `scripts/sources/youtube.ts` | B-0.2 | `search.list` 가 루프에 없고, 제목에서 부수·라운드·대회명이 파싱된다 | todo |
| B-1.5 | backend | 기상청 단기예보 연동 | `scripts/sources/weather.ts` | B-0.2 | 지역별 오늘 강수·기온·풍속이 나온다 | todo |
| B-1.2 | backend | 주차 스냅샷 저장 + 지난주 대비 변동 계산 | `src/lib/ranking.ts` `scripts/snapshot.ts` | B-1.1 | 첫 주차는 변동을 표시하지 않고, 둘째 주부터 `delta`/`NEW` 가 맞다 | **done** |
| B-1.6 | backend | 봇 게시 잡 — 스냅샷을 읽어 `posts` 를 만든다 | `scripts/publish.ts` | B-1.2 | 수집 실패 시 게시하지 않고 운영 알림만 남긴다 | todo |

---

## Phase 2 — 피드를 실데이터로 · 순차

| ID | 담당 | 할 일 | 파일 범위 | 선행 | 완료 기준 | 상태 |
|---|---|---|---|---|---|---|
| B-2.1 | backend | 피드 API (커서 페이지네이션, 20개) | `src/app/api/feed/**` | B-1.6 | 커서로 다음 장을 받고, 봇 3연속이 안 나오게 섞인다 | todo |
| F-2.2 | frontend | 피드를 API 에 연결 + 무한 스크롤 | `src/app/(app)/page.tsx` `src/components/**` | B-2.1 | mock 제거, 하단 3개 지점에서 선패치, 끝에 "여기까지입니다" | todo |
| F-2.3 | frontend | 새 글 표시 + 당겨서 새로고침 | `src/components/**` | F-2.2 | 보던 위치를 임의로 옮기지 않고 상단에 "새 글 N개" | todo |

---

## Phase 3 — 계정과 상호작용 · 순차

| ID | 담당 | 할 일 | 파일 범위 | 선행 | 완료 기준 | 상태 |
|---|---|---|---|---|---|---|
| B-3.1 | backend | 카카오 소셜 로그인 | `src/app/api/auth/**` `src/lib/auth.ts` | B-0.1 | 비회원도 피드를 읽고, 반응하려 할 때만 로그인 시트가 뜬다 | todo |
| B-3.2 | backend | 글쓰기 저장 API (500자, 5분 내 수정) | `src/app/api/posts/**` | B-3.1 | 수정은 5분 내만 허용하고 `(수정됨)` 플래그가 남는다 | todo |
| F-3.3 | frontend | 글쓰기 화면을 API 에 연결 | `src/app/compose/**` | B-3.2 | 글자수 표시, 게시 후 피드 상단 복귀 | todo |
| B-3.4 | backend | 좋아요·리포스트·인용 API | `src/app/api/reactions/**` | B-3.1 | 카운트는 비정규화 컬럼으로 읽는다 | todo |
| F-3.5 | frontend | 반응을 서버에 연동 (낙관적 갱신) | `src/components/post/PostActions.tsx` | B-3.4 | 실패 시 롤백되고 토스트가 뜬다 | todo |
| B-3.6 | backend | 댓글 API (**1단계만**, 대댓글 없음) | `src/app/api/comments/**` | B-3.1 | `parent_id` 가 2단계를 허용하지 않는다 | todo |
| F-3.7 | frontend | 포스트 상세 + 댓글 화면 | `src/app/(app)/p/[id]/**` | B-3.6 | 봇 포스트에도 댓글이 달린다 | todo |

---

## Phase 4 — 나머지 탭 · 전부 병렬 가능

셋 다 파일이 안 겹친다. **동시에 돌려도 된다.**

| ID | 담당 | 할 일 | 파일 범위 | 선행 | 완료 기준 | 상태 |
|---|---|---|---|---|---|---|
| F-4.1 | frontend | 검색 (선수·대회·클럽·장비) | `src/app/(app)/search/**` | B-2.1 | 선수 실명 전체 인덱스를 공개하지 않는다 | todo |
| F-4.2 | frontend | 활동 (알림) | `src/app/(app)/activity/**` | B-3.4 | 15분 단위로 묶어서 보여준다 | todo |
| F-4.3 | frontend | 프로필 (내 글과 반응) | `src/app/(app)/me/**` | B-3.1 | 선수 계정 연동은 넣지 않는다 (철회된 결정) | todo |

---

## Phase 5 — 운영 · 순차

| ID | 담당 | 할 일 | 파일 범위 | 선행 | 완료 기준 | 상태 |
|---|---|---|---|---|---|---|
| B-5.1 | backend | 신고·차단 (누적 3건 자동 블라인드) | `src/app/api/moderation/**` | B-3.1 | 차단 시 상대 글이 내 피드에서 사라진다 | todo |
| B-5.2 | backend | **발행된 payload 소급 마스킹** — 접수·억제·뷰 마스킹은 B-0.3 에서 끝났다. 이미 나간 `posts.payload` 안의 이름을 `posts_payload_gin` 으로 되짚어 지우는 잡만 남았다 | `scripts/**` `src/app/api/moderation/**` | B-5.1 | 억제된 선수가 기존 피드 포스트에서도 사라진다 | todo |
| B-5.3 | backend | 배포 (Vercel + 수집 잡 스케줄) | `vercel.json` `scripts/**` | Phase 2 | 랭킹은 월 09:00, 대회는 목 08:00, 영상은 매시간 | todo |

---

## 지금 할 수 있는 것

Phase 0 이 선행이라 **B-0.1 → B-0.2 를 먼저 순차로** 돌려야 한다.
그 다음 **B-1.1 / B-1.3 / B-1.4 / B-1.5 를 한 번에 네 개** 띄우는 게 이 로드맵에서
병렬 이득이 가장 큰 지점이다.

구현이 끝난 태스크는 `reviewer` → `qa` 순으로 넘긴다.
