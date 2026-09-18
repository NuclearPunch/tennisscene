<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

---

# 테니스씬 — 팀 운영 매뉴얼

프로젝트 규칙은 `CLAUDE.md`, 작업 목록은 `docs/ROADMAP.md`.
이 파일은 **누가 어느 파일을 소유하는가**와 **어떻게 넘기는가**만 정한다.

## 역할

| 에이전트 | 하는 일 | 쓰기 권한 |
|---|---|---|
| `planner` | 스펙 쪼개기, 태스크 정의, 결정 기록 | `docs/**` 만 |
| `backend` | 데이터 수집·API·스키마 | `src/lib/**`, `src/app/api/**`, `scripts/**`, `supabase/**` |
| `frontend` | 화면·컴포넌트 조립 | `src/components/post/**`, `src/app/(app)/**`, `src/app/compose/**` |
| `designer` | 타이포·색·아이콘·로고 | `src/app/globals.css`, `src/components/icons.tsx`, `docs/DESIGN.md` |
| `reviewer` | 결함 지적 | **없음** (읽기 전용) |
| `qa` | 실제 브라우저로 동작 검증 | `tests/**` 만 |

## 파일 소유권 — 이것만 지키면 충돌이 안 난다

경계를 넘어야 하면 **직접 고치지 말고 보고한다.** 메인 세션이 조율한다.

```
backend  소유   src/lib/  src/app/api/  scripts/  supabase/
frontend 소유   src/components/post/  src/app/(app)/  src/app/compose/
designer 소유   src/app/globals.css  src/components/icons.tsx
공유            src/lib/types.ts        ← 계약. backend 가 소유하고 frontend 는 읽기만
아무도 못 건드림  AGENTS.md 의 next 블록, next.config.ts, package.json (메인 세션만)
```

`src/lib/types.ts` 가 프론트와 백엔드를 잇는 유일한 접점이다.
**여기가 바뀌면 양쪽이 같이 깨진다.** backend 가 이 파일을 바꿀 때는
바꾼 내용을 결과 보고 맨 위에 적어서 frontend 가 이어받게 한다.

## 병렬로 돌려도 되는 것 / 안 되는 것

**동시에 돌려도 됨** — 파일 경계가 안 겹칠 때만.
- 서로 다른 수집 스크립트 (`scripts/kato.ts` / `scripts/youtube.ts` / `scripts/weather.ts`)
- 서로 다른 화면 (`/search` / `/activity` / `/me`)

**순차로 돌려야 함**
- 스키마 → API → 화면 (계약이 흐른다)
- 구현 → `reviewer` → `qa` (앞 결과가 입력이다)

역할이 다르다고 무조건 병렬이 되는 게 아니다. **같은 파일을 만지면 무조건 순차다.**

## 넘기는 방식

1. 태스크 하나 = 에이전트 하나. 태스크 ID(`B-1.1` 등)를 프롬프트에 넣는다.
2. 에이전트는 끝낼 때 **바꾼 파일 목록**과 **`types.ts` 변경 여부**를 먼저 보고한다.
3. 구현이 끝나면 `reviewer` → `qa` 순으로 넘긴다. 둘은 코드를 고치지 않는다.
4. 커밋은 메인 세션이 한다. 서브에이전트는 커밋하지 않는다.

## 공통 규칙

- 작업 전에 `CLAUDE.md` 의 "깨면 안 되는 규칙 5개"를 읽는다.
- 끝나면 `npx tsc --noEmit` 이 깨끗해야 한다.
- 실명 선수 데이터를 시드나 테스트에 넣지 않는다.
- 추측을 사실처럼 보고하지 않는다. 확인 못 한 건 "확인 불가"로 쓴다.
