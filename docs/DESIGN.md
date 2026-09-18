# 시각 언어

`designer` 에이전트가 소유한다. 토큰은 `src/app/globals.css`, 마크는 `src/components/icons.tsx`.

## 타이포 — Pretendard 하나로 끝낸다

```
"Pretendard Variable", Pretendard, -apple-system, BlinkMacSystemFont, system-ui
```

**왜 Noto Sans KR 을 버렸나.** 기본값이라 아무 손도 안 댄 티가 난다. Pretendard 는
국내에서 디자인 감각 있는 제품들이 실제로 쓰는 기본값이고, SF Pro 와 구조가 맞아
애플 느낌을 낼 때 정확하다. OFL 무료.

**숫자 전용 서체를 따로 두지 않는다.** 전에는 Schibsted Grotesk 를 섞었는데
서체를 둘 섞는 건 초보 티다. `font-variant-numeric: tabular-nums` 로 자릿수만
고정하고(`.num`), 위계는 **굵기와 크기**로 만든다.

자간은 20px 이상 타이틀에만 음수로 준다. 모든 요소에 넣지 않는다.

## 아이콘 — `@phosphor-icons/react`

직접 그린 SVG 는 획 굵기·모서리 반경·광학 크기가 미세하게 어긋나서 아마추어처럼 보인다.
UI 아이콘은 전부 Phosphor 를 쓴다.

`regular` → `fill` 로 활성 상태를 표현한다. 쓰레드식 탭바에 그대로 맞는다.

**직접 그리는 건 셋뿐이다** — 로고 마크(`BallMark`), 랭킹 카드 장식(`BallTexture`),
자동 게시 배지(`Verified`). 브랜드 요소라 라이브러리에 없다.

## 색

| 토큰 | 값 | 쓰는 곳 |
|---|---|---|
| `--color-bg` | `#FBFCFB` | 지면. 순백이 아니라 그린이 미세하게 섞인 흰색 |
| `--color-surface` | `#FFFFFF` | 카드 |
| `--color-grouped` | `#F2F5F3` | 이미지 자리, 비활성 배경 |
| `--color-hairline` | `#E6EBE8` | 구분선 |
| `--color-ink` | `#0E1A14` | 본문. 순검정 대신 그린블랙 |
| `--color-green` | `#0F7A4F` | 액센트 — 링크·활성 |
| `--color-green-deep` | `#0A5637` | 랭킹 카드 배경 |
| `--color-ball` | `#D8F550` | **딥그린 위에서만** |

**액센트는 하나다.** 상태색(`--color-green-hi` 상승 / `--color-down` 하락)만 예외.

### 대비 (계산값)

```
#0E1A14 on #FBFCFB   17.0:1   본문
#5A6B62 on #FBFCFB    5.5:1   보조
#657771 on #FBFCFB    4.6:1   3차 — 여기가 하한이다
#0F7A4F on #FBFCFB    5.3:1   액센트
#D8F550 on #0A5637    7.3:1   옵틱 옐로우, 딥그린 위
#D8F550 on #FBFCFB    1.1:1   ← 안 보인다. 절대 텍스트로 쓰지 않는다
```

## 형태

- 라운드: 카드 14px, 패널 16px. **전부 같은 값으로 통일하지 않는다**
- 그림자: `0 1px 3px rgba(14,26,20,0.05)` 수준. 거의 안 쓴다
- 위계는 **여백과 굵기**로 만든다. 색과 그림자를 더 쓰는 게 아니다
- 헤어라인은 텍스트 시작점부터 들여쓴다 (애플 리스트 방식)
- 터치 타깃 44px 이상

## 참고

쓰레드 · 인스타그램 · 애플 HIG · 토스 · 당근.
공통점은 절제다. 더해서 만든 화면이 아니라 빼서 만든 화면이다.
