-- 테니스씬 기반 스키마 · 6/8 — likes · reposts · follows · blocks · reports · name_removal_requests

-- ─────────────────────────────────────────────────────────────
-- likes
-- ─────────────────────────────────────────────────────────────
create table public.likes (
  account_id  text not null references public.accounts (id) on delete cascade,
  post_id     uuid not null references public.posts (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (account_id, post_id)
);

-- "이 포스트 좋아요 누른 사람" 조회용 (PK 는 account 선행이라 따로 필요하다)
create index likes_post_idx on public.likes (post_id, created_at desc);

create or replace function public.likes_sync_counter()
returns trigger
language plpgsql
-- 소유자 권한으로 돈다. 호출자 권한이면 authenticated 에게 카운터 컬럼 update 권한이
-- 없어 항상 permission denied 로 터지고, 권한을 주면 이번엔 posts_update_own 의
-- using 절이 남의 글 카운터 갱신을 조용히 0행으로 만든다.
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.posts set like_count = like_count + 1 where id = new.post_id;
  else
    update public.posts set like_count = greatest(like_count - 1, 0) where id = old.post_id;
  end if;
  return null;
end;
$$;

create trigger likes_sync_counter_ins
  after insert on public.likes
  for each row execute function public.likes_sync_counter();
create trigger likes_sync_counter_del
  after delete on public.likes
  for each row execute function public.likes_sync_counter();


-- ─────────────────────────────────────────────────────────────
-- reposts (원문 그대로 퍼가기)
-- 인용 리포스트는 별도 테이블이 아니라 posts.quoted_post_id 다.
-- 둘 다 posts.repost_count 에 합산된다.
-- ─────────────────────────────────────────────────────────────
create table public.reposts (
  account_id  text not null references public.accounts (id) on delete cascade,
  post_id     uuid not null references public.posts (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (account_id, post_id)
);

create index reposts_post_idx on public.reposts (post_id, created_at desc);

create or replace function public.reposts_sync_counter()
returns trigger
language plpgsql
-- 소유자 권한으로 돈다. 호출자 권한이면 authenticated 에게 카운터 컬럼 update 권한이
-- 없어 항상 permission denied 로 터지고, 권한을 주면 이번엔 posts_update_own 의
-- using 절이 남의 글 카운터 갱신을 조용히 0행으로 만든다.
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.posts set repost_count = repost_count + 1 where id = new.post_id;
  else
    update public.posts set repost_count = greatest(repost_count - 1, 0) where id = old.post_id;
  end if;
  return null;
end;
$$;

create trigger reposts_sync_counter_ins
  after insert on public.reposts
  for each row execute function public.reposts_sync_counter();
create trigger reposts_sync_counter_del
  after delete on public.reposts
  for each row execute function public.reposts_sync_counter();


-- ─────────────────────────────────────────────────────────────
-- follows
-- 1차 피드는 시간순 전체이고 팔로우로 거르지 않는다. 관계만 먼저 쌓아둔다.
-- ─────────────────────────────────────────────────────────────
create table public.follows (
  follower_id  text not null references public.accounts (id) on delete cascade,
  followee_id  text not null references public.accounts (id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (follower_id, followee_id),
  constraint follows_no_self check (follower_id <> followee_id)
);

create index follows_followee_idx on public.follows (followee_id, created_at desc);


-- ─────────────────────────────────────────────────────────────
-- blocks
-- 차단하면 상대 글이 내 피드에서 사라진다 (posts_public 뷰가 양방향으로 거른다).
-- ─────────────────────────────────────────────────────────────
create table public.blocks (
  blocker_id  text not null references public.accounts (id) on delete cascade,
  blocked_id  text not null references public.accounts (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint blocks_no_self check (blocker_id <> blocked_id)
);

create index blocks_blocked_idx on public.blocks (blocked_id);


-- ─────────────────────────────────────────────────────────────
-- reports
-- 익명 글은 임계치 2건, 실명은 3건에서 자동 블라인드 (B-5.1 에서 붙인다).
-- 여기서는 접수만 받는다.
-- ─────────────────────────────────────────────────────────────
create table public.reports (
  id                uuid primary key default gen_random_uuid(),
  reporter_id       text not null references public.accounts (id) on delete cascade,

  -- 포스트 신고 또는 계정 신고. 정확히 하나만 채운다.
  target_post_id    uuid references public.posts (id) on delete cascade,
  target_account_id text references public.accounts (id) on delete cascade,

  reason            text not null check (char_length(reason) between 1 and 500),
  detail            text check (char_length(detail) <= 1000),
  status            public.report_status not null default 'open',

  created_at        timestamptz not null default now(),
  resolved_at       timestamptz,
  resolution_note   text,

  constraint reports_one_target check (
    (target_post_id is not null)::int + (target_account_id is not null)::int = 1
  )
);

-- 같은 사람이 같은 대상을 여러 번 신고해도 임계치가 1건으로만 센다
create unique index reports_unique_post_reporter
  on public.reports (reporter_id, target_post_id)
  where target_post_id is not null;
create unique index reports_unique_account_reporter
  on public.reports (reporter_id, target_account_id)
  where target_account_id is not null;

-- 임계치 집계
create index reports_target_post_idx
  on public.reports (target_post_id)
  where target_post_id is not null;
create index reports_open_idx
  on public.reports (created_at desc)
  where status = 'open';


-- ─────────────────────────────────────────────────────────────
-- name_removal_requests
-- 선수 본인이 "내 이름 내려달라"고 요청하는 경로.
-- 1차부터 있어야 한다 — 우리가 공개 랭킹의 실명을 재게시하는 이상,
-- 삭제 요청을 받을 창구가 없으면 개인정보 문제를 방어할 수 없다.
-- 로그인 없이도 접수할 수 있어야 한다. 요청자가 우리 회원일 이유가 없다.
-- ─────────────────────────────────────────────────────────────
create table public.name_removal_requests (
  id             uuid primary key default gen_random_uuid(),

  -- 내려달라는 대상
  player_name    text not null check (char_length(player_name) between 1 and 40),
  club           text,
  org            text,
  division       text,
  -- 알면 적고, 모르면 비운다. 있으면 ranking_snapshots 와 바로 맞춘다.
  player_key     text,

  -- 본인 확인용 연락처. 민감정보라 anon/authenticated 에게 읽기 권한을 주지 않는다.
  contact        text not null check (char_length(contact) between 1 and 200),
  -- 접수자가 로그인 상태였다면 기록
  requester_id   text references public.accounts (id) on delete set null,

  message        text check (char_length(message) <= 1000),
  status         public.name_removal_status not null default 'received',

  created_at     timestamptz not null default now(),
  resolved_at    timestamptz,
  resolution_note text
);

comment on table public.name_removal_requests is
  '선수 본인의 이름 비공개 요청 접수함. 승인되면 해당 이름이 마스킹된다 (B-5.2). '
  'contact 는 개인정보이므로 service_role 만 읽는다.';


-- ─────────────────────────────────────────────────────────────
-- suppressed_players
-- 승인된 이름 삭제 요청이 실제로 적용되는 곳.
--
-- 접수 창구만 열고 내릴 방법이 없으면 "요청받고 무시한 기록"만 남아 법적으로 더 나쁘다.
-- 그래서 처리 경로를 1차부터 같이 넣는다.
--
-- 이름은 두 곳에 산다:
--   1) ranking_snapshots.player_name  — 여기는 org+player_key 로 바로 찾는다
--   2) 이미 발행된 posts.payload jsonb 안 — 스냅샷을 지워도 피드에 남는다
-- 그래서 랭킹 payload 에는 playerKey 를 반드시 넣는다(src/lib/types.ts RankingEntry).
-- posts_payload_gin 으로 되짚을 수 있다.
-- ─────────────────────────────────────────────────────────────
create table public.suppressed_players (
  org         text not null,
  player_key  text not null,

  -- 어느 요청으로 억제됐는지. 요청 없이 운영 판단으로 넣을 수도 있어 nullable.
  request_id  uuid references public.name_removal_requests (id) on delete set null,
  reason      text,
  created_at  timestamptz not null default now(),

  primary key (org, player_key)
);

comment on table public.suppressed_players is
  '이름 비공개가 승인된 선수. 조회 경로에서 이름을 마스킹한다.';

create index suppressed_players_key_idx
  on public.suppressed_players (player_key);


-- 억제 여부를 한 번에 판단하는 함수. 뷰와 수집 잡이 같이 쓴다.
create or replace function public.is_player_suppressed(p_org text, p_player_key text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.suppressed_players s
    where s.org = p_org and s.player_key = p_player_key
  );
$$;

create index name_removal_requests_open_idx
  on public.name_removal_requests (created_at desc)
  where status in ('received', 'verifying');
create index name_removal_requests_player_idx
  on public.name_removal_requests (player_name, club);
