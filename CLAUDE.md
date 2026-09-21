# 테니스씬

한국 아마추어 테니스 동호인용 **단일 피드형 SNS**. 랭킹·대회·경기영상·장비·날씨가
자동으로 피드에 올라오고, 그 위에 유저가 글을 얹는다.

기획 원본: [테니스 동호인 SNS 기획서](https://claude.ai/code/artifact/31f01dc2-2c95-4cab-aabc-057ec3bb5c8e)
디자인: [피드 컨셉 캔버스](https://claude.ai/artifact/UznvdxA5wrfcrcNuVHDQk4)

## 깨면 안 되는 규칙

1. **화면은 피드 하나다.** 랭킹·영상·장비를 탭이나 섹션으로 쪼개지 않는다.
   탭바는 앱 내비게이션(홈·검색·작성·활동·프로필)일 뿐 콘텐츠 탭이 아니다.
   상단의 **해시태그 모아보기(`TagBar`)는 필터지 탭이 아니다** — 기본으로 눌린 칩이
   없고, 누르면 걸리고 다시 누르면 풀린다. "전체" 칩을 기본 선택으로 두는 순간
   그건 콘텐츠 탭이 된다. 두지 마라.
2. **봇도 유저와 같은 포스트 템플릿을 쓴다.** 아바타 + 계정명 + 시간 + 본문 +
   첨부 + 반응. 구분은 이름 옆 체크 배지 하나뿐이다. 공지 전용 UI를 만들지 않는다.
3. **랭킹은 주간 다이제스트.** 실시간 아님. 선수별 변동 포스트를 쏟아내면 피드가 죽는다.
4. **옵틱 옐로우(`--color-ball`)를 흰 바탕 위 글자로 쓰지 않는다.** 대비가 1.1:1이라
   안 보인다. 채움으로 쓰고 그 위에 딥그린 글자를 얹거나(`1위` `우승` 표식), 딥그린
   위에 얹는다(아바타). **디자인 기준은 쓰레드 앱이다** — 시스템 서체, 흑백, 시스템
   라이트/다크, 떠 있는 유리 탭바. 글자 크기는 13·15·20 셋뿐이고 사이 값은 만들지 않는다.
   세리프·크림색 바탕은 철회된 방향이다. 근거는 `docs/DESIGN.md`.
   **`Logo.tsx` 는 생성물이라 손으로 고치지 않는다.**
5. **정렬은 시간순 고정.** 추천 알고리즘 없음.

## 구조

```
src/lib/types.ts       Post·Attachment 판별 유니온
src/lib/accounts.ts    봇 계정 (accounts 테이블의 row와 같은 모양)
src/lib/sources/       외부 소스 어댑터 (파싱만, DB 모름)
src/lib/publish/       payload·본문 생성 (순수 함수, DB 모름)
src/lib/jobs/          수집·게시 잡의 알맹이. CLI 와 크론이 같은 함수를 부른다
scripts/               잡의 CLI 껍데기 (--dry-run --fixture --sql)
src/app/api/cron/      Vercel 크론. 매일 09:00 KST, 월요일만 랭킹까지
src/app/manifest.ts    PWA. public/sw.js 는 피드와 /api 를 절대 캐시하지 않는다
src/lib/postInput.ts   글쓰기 검증. 화면과 API 가 같은 함수를 쓴다
src/lib/me.ts          useMe() — guest / needs-profile / ready
src/components/post/   PostCard → Attachment 가 type 으로 분기
src/app/(app)/         탭바가 붙는 셸. / · /search · /activity · /me
src/app/compose/       탭바 없는 전체화면
```

포스트 타입을 추가할 때는 `types.ts`의 `Attachment` 유니온에 넣고
`Attachment.tsx`의 `switch`에 렌더러를 더한다. 테이블은 하나로 유지한다.

## 데이터

1차는 **카토(kato.kr) 데이터만** 쓴다. 생체(KTA)는 약관 제12·13조가 상업적 가공을
명시적으로 금지하므로 제휴 전까지 프로덕션에 넣지 않는다. 공개된 부서별 상위 50명만
쓰고 전수 수집·회원 DB 구축은 하지 않는다.

**대회 결과도 시상대(우승·준우승·공동 3위)까지만 담는다.** 소스는 32강까지 주고
대진표에는 128강 전원이 있지만, 그 아래는 뉴스가 아니라 남의 참가자 명단이다.
더 보고 싶은 사람은 원문 대진표 링크로 보낸다.

선수 실명은 파싱하되 검색 인덱스로 공개하지 않는다. 시드 데이터도 가상 인물을 쓴다.
`suppressed_players` 에 올라온 선수는 랭킹·결과 **양쪽 경로에서** 걸러야 한다 —
카토의 선수 ID 가 두 소스에서 같은 값이라 목록 하나로 둘 다 막힌다.

## 팀

서브에이전트 역할과 파일 소유권은 `AGENTS.md`, 작업 목록은 `docs/ROADMAP.md`,
철회된 결정은 `docs/DECISIONS.md` 에 있다.

에이전트: `planner` `backend` `frontend` `designer` `reviewer` `qa`

**역할이 다르다고 무조건 병렬이 되는 게 아니다. 같은 파일을 만지면 순차다.**
