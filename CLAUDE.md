# 테니스씬

한국 아마추어 테니스 동호인용 **단일 피드형 SNS**. 랭킹·대회·경기영상·장비·날씨가
자동으로 피드에 올라오고, 그 위에 유저가 글을 얹는다.

기획 원본: [테니스 동호인 SNS 기획서](https://claude.ai/code/artifact/31f01dc2-2c95-4cab-aabc-057ec3bb5c8e)
디자인: [피드 컨셉 캔버스](https://claude.ai/artifact/UznvdxA5wrfcrcNuVHDQk4)

## 깨면 안 되는 규칙

1. **화면은 피드 하나다.** 랭킹·영상·장비를 탭이나 섹션으로 쪼개지 않는다.
   탭바는 앱 내비게이션(홈·검색·작성·활동·프로필)일 뿐 콘텐츠 탭이 아니다.
2. **봇도 유저와 같은 포스트 템플릿을 쓴다.** 아바타 + 계정명 + 시간 + 본문 +
   첨부 + 반응. 구분은 이름 옆 체크 배지 하나뿐이다. 공지 전용 UI를 만들지 않는다.
3. **랭킹은 주간 다이제스트.** 실시간 아님. 선수별 변동 포스트를 쏟아내면 피드가 죽는다.
4. **옵틱 옐로우(`--color-ball`)는 딥그린 위에서만.** 흰 배경 위 대비가 1.1:1이라
   텍스트로 쓰면 안 보인다.
5. **정렬은 시간순 고정.** 추천 알고리즘 없음.

## 구조

```
src/lib/types.ts       Post·Attachment 판별 유니온
src/lib/accounts.ts    봇 계정 (accounts 테이블의 row와 같은 모양)
src/lib/mock.ts        시드 데이터 — 수집 파이프라인 붙기 전까지
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

선수 실명은 파싱하되 검색 인덱스로 공개하지 않는다. 시드 데이터도 가상 인물을 쓴다.

## 팀

서브에이전트 역할과 파일 소유권은 `AGENTS.md`, 작업 목록은 `docs/ROADMAP.md`,
철회된 결정은 `docs/DECISIONS.md` 에 있다.

에이전트: `planner` `backend` `frontend` `reviewer` `qa`

**역할이 다르다고 무조건 병렬이 되는 게 아니다. 같은 파일을 만지면 순차다.**
