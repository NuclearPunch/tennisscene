-- 테니스씬 기반 스키마 · 4/8 — ranking_snapshots
--
-- 이 서비스의 심장이다.
-- 원본 사이트는 "지난주 대비 변동"을 주지 않는다. 주차별 순위를 통째로 쌓아두고
-- 직전 주차와 조인해서 우리가 계산한다. 첫 주차는 비교 대상이 없으므로 변동을 표시하지 않는다.
--
-- 한 선수가 여러 부서에 다른 점수로 동시에 등재되므로 키는 (org, division, week, player_key) 다.

create table public.ranking_snapshots (
  -- 1차는 카토만 쓴다. 생체(KTA)는 이용약관 제12·13조가 정보의 가공·판매와 상업적
  -- 이용을 명시 금지하고, 카타는 선수 고유 ID가 없어 시즌 간 추적이 깨진다
  -- (docs/DECISIONS.md). 주석이 아니라 DB 가 거부해야 실수로 들어갔을 때 즉시 터진다.
  -- 제휴하면 이 check 한 줄을 푼다.
  org           text not null check (org in ('kato')),

  -- 부서/부수. 단체마다 축이 다르므로 (생체는 연령·성별, 카토는 실력 등급)
  -- 통합하지 않고 단체×부서로 따로 쌓는다.
  division      text not null,

  -- ISO 주차 문자열. 예: '2026-W37'
  week          text not null
                  check (week ~ '^[0-9]{4}-W(0[1-9]|[1-4][0-9]|5[0-3])$'),

  player_key    text not null,

  rank          integer not null check (rank > 0),
  player_name   text not null,
  club          text,
  region        text,
  points        numeric(10, 2),

  -- 원본 추적용. 어댑터가 바뀌어도 어디서 왔는지 남는다.
  source_url    text,
  collected_at  timestamptz not null default now(),

  primary key (org, division, week, player_key)
);

comment on table public.ranking_snapshots is
  '주차별 랭킹 원본 적재. 변동(delta)은 저장하지 않고 직전 주차와 조인해 계산한다.';

comment on column public.ranking_snapshots.player_key is
  '선수 식별자. 소스마다 만드는 방법이 다르다. '
  '카토: /careers/{id} 의 고유 ID 를 그대로 쓴다 (시즌 간 동일인 추적이 된다). '
  '카타: 선수 고유 ID 가 없다. hash(이름 + 소속클럽) 으로 만든다 — '
  '이름이 같고 클럽을 옮기면 다른 사람으로 보이고, 동명이인이 같은 클럽이면 한 사람으로 뭉친다. '
  '이 한계 때문에 카타는 제휴 전까지 프로덕션에 넣지 않는다. '
  '어느 방식이든 키 생성 규칙은 소스 어댑터(src/lib/sources/**)가 소유한다.';

comment on column public.ranking_snapshots.week is
  'ISO 주차 문자열 ''YYYY-Www'' (예: 2026-W37). 화면 표기는 조회 시점에 만든다.';

comment on column public.ranking_snapshots.points is
  '원본 포인트. 카토는 1년 롤링이라 절대값보다 주차 간 차이가 의미 있다.';

-- 상위 N명 조회 (주간 다이제스트 포스트가 이걸로 만들어진다)
create index ranking_snapshots_top_idx
  on public.ranking_snapshots (org, division, week, rank);

-- 한 선수의 주차별 추이 / 직전 주차 조인
create index ranking_snapshots_player_idx
  on public.ranking_snapshots (org, player_key, week desc);

-- 수집 상태 점검 (직전 주 대비 수집량 50% 미만이면 게시 중단)
create index ranking_snapshots_week_idx
  on public.ranking_snapshots (week, org, division);
