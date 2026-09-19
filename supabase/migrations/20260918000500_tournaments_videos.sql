-- 테니스씬 기반 스키마 · 5/8 — tournaments · videos
--
-- 둘 다 "수집된 것"과 "게시된 것"을 분리한다.
-- collected_at 은 우리가 가져온 시각, posted_at 은 봇이 피드에 올린 시각이다.
-- 이게 갈라져 있어야 재수집이 안전하다 — 다시 긁어도 이미 올라간 건 다시 안 올라간다.
-- 수집이 실패하면 게시하지 않는다. 피드에 에러 카드를 띄우지 않는다.

create table public.tournaments (
  id             uuid primary key default gen_random_uuid(),

  org            text not null,
  -- 소스에서 이 대회를 다시 찾아낼 키. 재수집 시 중복 방지의 축이다.
  source_key     text not null,
  source_url     text,

  name           text not null,
  venue          text,
  region         text,

  -- 라벨이 아니라 날짜로 저장한다. '09.24 (수)' 같은 표기는 조회 시점에 만든다.
  starts_on      date,
  ends_on        date,
  deadline_at    timestamptz,

  divisions      text[] not null default '{}',

  collected_at   timestamptz not null default now(),
  -- 게시 전이면 null. 게시 잡이 이걸 보고 안 올라간 것만 고른다.
  posted_at      timestamptz,
  post_id        uuid references public.posts (id) on delete set null,

  constraint tournaments_source_unique unique (org, source_key),
  constraint tournaments_date_order check (ends_on is null or starts_on is null or ends_on >= starts_on)
);

comment on table public.tournaments is
  '수집된 대회. posted_at 이 null 이면 아직 피드에 안 올라갔다.';
comment on column public.tournaments.source_key is
  '소스 내 고유 키. URL 구조가 바뀌어도 어댑터가 같은 값을 만들어내야 재수집이 중복을 안 만든다.';

create index tournaments_unposted_idx
  on public.tournaments (collected_at)
  where posted_at is null;
create index tournaments_deadline_idx
  on public.tournaments (deadline_at)
  where deadline_at is not null;


create table public.videos (
  id               uuid primary key default gen_random_uuid(),

  provider         text not null default 'youtube',
  -- 유튜브 videoId. channels.list 로 받은 uploads 플레이리스트를
  -- playlistItems.list 로 순회해서 얻는다. search.list 는 수집 루프에 넣지 않는다.
  provider_video_id text not null,

  channel_id       text,
  channel_title    text,

  title            text not null,
  duration_seconds integer check (duration_seconds is null or duration_seconds >= 0),
  thumbnail_url    text,
  published_at     timestamptz,

  -- 제목에서 파싱한 것들. 못 뽑으면 null 이고 게시하지 않는다.
  tournament_name  text,
  division         text,
  round            text,

  collected_at     timestamptz not null default now(),

  -- 유튜브 API 약관: 저장한 메타데이터·썸네일은 30일 내에 갱신하거나 삭제해야 한다.
  -- 이 컬럼이 없으면 언제 지워야 하는지 알 수 없다. 필수다.
  refreshed_at     timestamptz not null default now(),

  posted_at        timestamptz,
  post_id          uuid references public.posts (id) on delete set null,

  constraint videos_provider_unique unique (provider, provider_video_id)
);

comment on table public.videos is
  '수집된 경기 영상. posted_at 이 null 이면 아직 피드에 안 올라갔다.';
comment on column public.videos.refreshed_at is
  '메타·썸네일을 마지막으로 원본에서 다시 확인한 시각. '
  '유튜브 API 약관상 30일이 지난 저장분은 갱신하거나 삭제해야 한다. '
  'videos_stale_idx 로 오래된 것부터 뽑아 갱신 잡을 돌린다.';

-- 30일 지난 것부터 갱신/삭제 대상으로 뽑는다
create index videos_stale_idx on public.videos (refreshed_at);
create index videos_unposted_idx
  on public.videos (collected_at)
  where posted_at is null;
create index videos_published_idx on public.videos (published_at desc);
