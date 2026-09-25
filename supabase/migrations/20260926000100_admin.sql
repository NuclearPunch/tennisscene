-- 관리자 — 채널 관리 · 수집 기록 · 글 숨기기
--
-- **관리자 여부는 DB 가 판단한다.** 화면이나 API 가 실수로 관리자 버튼을 보여줘도
-- 여기 정책을 통과하지 못하면 아무것도 안 바뀐다. service_role 은 여전히 쓰지 않는다.
--
-- 관리자를 지정하는 화면은 **일부러 만들지 않는다.** 화면이 있으면 그 화면이 뚫리는 순간
-- 누구나 스스로를 관리자로 올린다. 지정은 SQL 로만 한다(맨 아래).


-- ─────────────────────────────────────────────────────────────
-- 관리자
-- ─────────────────────────────────────────────────────────────
create table public.admins (
  account_id  text primary key references public.accounts (id) on delete cascade,
  granted_at  timestamptz not null default now()
);

comment on table public.admins is
  '관리자 계정. 지정은 SQL 로만 한다 — 화면으로 올릴 수 있으면 그 화면이 권한 상승 통로가 된다.';

alter table public.admins enable row level security;
revoke all on public.admins from public, anon, authenticated;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admins a
    join public.accounts c on c.id = a.account_id
    where a.account_id = public.current_account_id()
      and c.deleted_at is null
  );
$$;

comment on function public.is_admin() is '지금 요청한 사람이 관리자인가. 비회원·일반 회원은 false.';

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;


-- ─────────────────────────────────────────────────────────────
-- 유튜브 채널 — 코드 상수에서 옮겨 온다
--
-- 전에는 src/lib/sources/youtube.ts 의 CHANNELS 배열이었다. 채널 하나 넣고 빼는 데
-- 배포가 필요했다. 이제 관리자 화면에서 바꾸고 다음 수집부터 반영된다.
--
-- **빼는 건 지우는 게 아니라 끄는 것이다.** 왜 뺐는지(note)가 남아야
-- 같은 채널을 다시 검토하느라 시간을 쓰지 않는다.
-- ─────────────────────────────────────────────────────────────
create table public.youtube_channels (
  -- 업로드 재생목록 ID. 채널 ID 의 'UC' 를 'UU' 로 바꾼 값이다. 매일 이걸로 훑는다(1 유닛).
  uploads     text primary key check (uploads ~ '^UU[A-Za-z0-9_-]{22}$'),
  title       text not null check (char_length(title) between 1 and 100),
  -- '@jangguntennis' 같은 핸들. 사람이 알아보기 위한 것이라 없어도 된다.
  handle      text check (char_length(handle) <= 100),
  note        text not null default '' check (char_length(note) <= 1000),
  enabled     boolean not null default true,
  added_by    text references public.accounts (id) on delete set null
                default public.current_account_id(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.youtube_channels is
  '경기 영상을 수집하는 유튜브 채널. 빼는 건 enabled=false 로 끈다 — 뺀 이유(note)를 남긴다.';

alter table public.youtube_channels enable row level security;
revoke all on public.youtube_channels from public, anon, authenticated;
grant select, insert on public.youtube_channels to authenticated;
grant update (title, handle, note, enabled, updated_at) on public.youtube_channels to authenticated;

create policy youtube_channels_admin_select on public.youtube_channels
  for select to authenticated using (public.is_admin());
create policy youtube_channels_admin_insert on public.youtube_channels
  for insert to authenticated with check (public.is_admin());
create policy youtube_channels_admin_update on public.youtube_channels
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- 지금 수집 중인 여덟 곳. 근거는 커밋 기록과 src/lib/sources/youtube.ts 옛 주석에 있다.
insert into public.youtube_channels (uploads, title, note, enabled, added_by) values
  ('UUgQVX3fx6bazHfD6VLCADbA', 'KATO Tennis',
   '카토 공식. 제목 규칙이 가장 정확하다(대회·부서·라운드·선수). 2025-01 이후 멈췄다.', true, null),
  ('UUeXOI5jmoJmhumQ-JlO_1pA', '클라스테니스',
   '동호인 실전 경기 전문. 활발하지만 제목이 홍보문구에 가까워 메타데이터를 덜 믿는다.', true, null),
  ('UUzL5Vf5U9Ir_5cAQPVfKtgQ', '테니스라이브',
   '동호인 대회 라이브 중계. 제목이 조각나 있어(선수만, 부서만) 대회명이 빠질 때가 많다.', true, null),
  ('UUfk8s5xSKyRG-U49r1U0yTA', '어택 덕스 테니스',
   '우리 데이터와 직접 맞물린다. 대회·부서·라운드·선수·클럽이 다 제목에 있고 그 선수들이 우리 결과에 있다.', true, null),
  ('UUgNG4r-KdDIt0pSfcp8d9rw', '공자테니스',
   '전남·광주 생활체육 대회. ''(오픈부 결승)'' 형식이 일정하다. 카토 대회가 아니라 결과 매칭은 안 된다.', true, null),
  ('UUOhApwd9XBkeYzsl7fsE2FA', 'KATA TENNIStube',
   '카타 옛 공식 채널. 형식이 깔끔하지만 2025-08 이후 멈췄다. 재개하면 저절로 잡힌다.', true, null),
  ('UUiTHNeO-ti75vj3QlFHclAA', 'KATATENNIS',
   '카타가 지금 쓰는 채널. ''2026 파티온배 오픈부 준결승2'' 처럼 깔끔하다. 20편 중 경기 10편이 다 걸리고 나머지는 쇼츠.', true, null),
  ('UUo4xDJEgAkl_oPeJk_gjMlQ', '장군테니스',
   '지역 협회장배·초청대회. 20편 중 경기 10편이 잡힌다. 2026-05 이후 멈췄지만 재개하면 잡힌다.', true, null);

-- 검토했지만 넣지 않은 곳. 꺼 둔 채로 남긴다 — 같은 채널을 다시 알아보지 않게.
insert into public.youtube_channels (uploads, title, note, enabled, added_by) values
  ('UU2IxkYDiKnPJGHjchx8oU0Q', '테니스TV',
   '815신공 동호인 경기를 4K 로 올리지만 제목 해석이 0/20. ''결승진출팀은 과연? … (4강전)'' 에서 라운드를 앞의 결승으로 읽는다. 해석을 고치면 넣을 만하다.', false, null),
  ('UUcD8F-b6iJSbtc8XxeYUt5A', 'VIEW티플 테니스',
   '경기도지사기 시군 대항전 실경기가 많지만 ''50세부'' ''경기도지사기'' 를 못 읽어 0편. 걸리는 3편은 쇼츠.', false, null),
  ('UUBPHJTsYCf8rr2zO0BfBG4w', 'THE TENNIS방극종',
   '채널 머리말 ''더 테니스'' 를 대회 이름으로 읽는다. 2026-06 이후 멈췄다.', false, null),
  ('UU9ga60Zr9AZ8gAenOg_x9hQ', '지스타테니스',
   '''전국 남자 복식 최고수전'' 을 대회로 못 읽어 0편. 2025-10 이후 멈췄다.', false, null),
  ('UUTXXF23MqtFPfb6Yh_l5z8w', '최인테니스',
   '순천만국가정원배 지도자부. 걸리는 5편 중 4편이 쇼츠라 실경기는 1편.', false, null),
  ('UU5PnKzN8tbQyXPlOEb7tzjg', '야메테니스',
   '대부분 해시태그 쇼츠. 제목의 #오픈부 는 경기 부서가 아니라 검색용 태그다.', false, null),
  ('UU1T-bHkswDukxXWAzb8ZSEw', '메모리슬립 테니스팀', '클럽 입상 홍보 쇼츠.', false, null),
  ('UU58lixuMMh6CjhyHzrseA0Q', '테니스에미친남자들',
   '클럽 연습 게임. ''박인용(오픈부)'' 는 선수 소개지 경기 부서가 아니다.', false, null),
  ('UUJ0Z1d6aqieISJcdcOyqhbA', '양구매치', '주니어 대회(초등부·고등부).', false, null),
  ('UUJHT8Ej178IVx8Gbe68-AVQ', '테니스피플', '요즘 제목이 ''20260920092141 1'' 같은 타임스탬프다.', false, null),
  ('UUQHbfK4WUev-0CdnxIKqoSA', '아테TV', '형식은 좋지만 2024-03 이후 멈췄다.', false, null),
  ('UUUIcm-qoO35kHy5vM_ECRPg', '테테테 TETETE', '2023-11 이후 멈췄다.', false, null),
  ('UU_0KlMiTzpejiet6ovAtoOQ', '정진화테니스레슨', '레슨 채널. 대회 영상은 2019년 것들이다.', false, null),
  ('UUu1kcA4Yn9ju-EbQ5Mv_hsQ', 'Honey Life', '테니스 브이로그·쇼츠. 경기 영상이 없고 2026-03 이후 멈췄다.', false, null),
  ('UUwhuELYbpwt9YYpREXFInTQ', '고우석 테니스', '개인 모임 영상. 걸리는 한 편은 제목에 스스로 ''불펌'' 이라고 적었다.', false, null);

-- 채널별 성적. 채널 목록 화면이 한 번에 읽는다.
--
-- 영상과 채널은 **채널 이름으로** 잇는다. videos 에 채널 ID 가 아직 안 채워져서다.
-- 채널이 이름을 바꾸면 그 전 영상이 0 으로 보인다 — 알고 둔다.
create or replace function public.admin_channel_stats()
returns table (
  uploads text, title text, handle text, note text, enabled boolean,
  created_at timestamptz, collected int, posted int, posted_30d int, last_published timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select c.uploads, c.title, c.handle, c.note, c.enabled, c.created_at,
         coalesce(v.collected, 0), coalesce(p.posted, 0), coalesce(p.posted_30d, 0), v.last_published
  from public.youtube_channels c
  left join (
    select channel_title, count(*)::int collected, max(published_at) last_published
    from public.videos group by channel_title
  ) v on v.channel_title = c.title
  left join (
    select payload->>'channelTitle' ch,
           count(*)::int posted,
           count(*) filter (where created_at > now() - interval '30 days')::int posted_30d
    from public.posts
    where type = 'video' and deleted_at is null
    group by 1
  ) p on p.ch = c.title
  where public.is_admin()
  order by c.enabled desc, coalesce(p.posted_30d, 0) desc, c.created_at;
$$;

-- Supabase 는 새 함수에 anon 실행 권한을 직접 준다. public 에서 걷는 것만으로는 안 빠진다.
revoke all on function public.admin_channel_stats() from public, anon;
grant execute on function public.admin_channel_stats() to authenticated;


-- ─────────────────────────────────────────────────────────────
-- 수집 기록
--
-- 크론이 도는지 안 도는지를 Vercel 로그를 뒤져야만 알 수 있었다.
-- 잡 하나가 끝날 때마다 한 줄씩 남긴다. 쓰는 건 잡(직접 연결)만 하고, 관리자는 읽기만 한다.
-- ─────────────────────────────────────────────────────────────
create table public.job_runs (
  id           bigint generated always as identity primary key,
  job          text not null,
  -- cron: 매일 아침 자동 · manual: 관리자 화면에서 누름
  trigger      text not null check (trigger in ('cron', 'manual')),
  ok           boolean not null,
  summary      text not null,
  lines        jsonb not null default '[]',
  duration_ms  integer not null,
  started_at   timestamptz not null,
  -- 손으로 돌린 사람. 크론이면 null.
  run_by       text references public.accounts (id) on delete set null
);

create index job_runs_recent_idx on public.job_runs (started_at desc);

alter table public.job_runs enable row level security;
revoke all on public.job_runs from public, anon, authenticated;
grant select on public.job_runs to authenticated;
create policy job_runs_admin_select on public.job_runs
  for select to authenticated using (public.is_admin());


-- ─────────────────────────────────────────────────────────────
-- 글 숨기기
--
-- 숨기는 건 deleted_at 을 채우는 것이다 — 피드·검색·상세가 전부 이미 그걸 거른다.
-- 다만 **작성자가 지운 것과 관리자가 숨긴 것은 구분해야 한다.** 되살리기는 관리자가
-- 숨긴 것만 된다. 작성자가 지운 글을 관리자가 되살리면 안 된다.
-- 그래서 누가 언제 왜 숨겼는지를 따로 남긴다.
-- ─────────────────────────────────────────────────────────────
create table public.moderation_actions (
  id          bigint generated always as identity primary key,
  post_id     uuid not null references public.posts (id) on delete cascade,
  action      text not null check (action in ('hide', 'restore')),
  reason      text check (char_length(reason) <= 300),
  actor_id    text references public.accounts (id) on delete set null,
  created_at  timestamptz not null default now()
);

create index moderation_actions_post_idx on public.moderation_actions (post_id, created_at desc);

alter table public.moderation_actions enable row level security;
revoke all on public.moderation_actions from public, anon, authenticated;

create or replace function public.admin_hide_post(target uuid, why text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception '관리자만 할 수 있습니다' using errcode = '42501';
  end if;
  update public.posts set deleted_at = now() where id = target and deleted_at is null;
  if not found then
    raise exception '없거나 이미 내려간 글입니다' using errcode = 'P0002';
  end if;
  insert into public.moderation_actions (post_id, action, reason, actor_id)
  values (target, 'hide', nullif(btrim(why), ''), public.current_account_id());
end;
$$;

create or replace function public.admin_restore_post(target uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  last_action text;
begin
  if not public.is_admin() then
    raise exception '관리자만 할 수 있습니다' using errcode = '42501';
  end if;
  select action into last_action from public.moderation_actions
  where post_id = target order by created_at desc, id desc limit 1;
  -- 작성자가 스스로 지운 글은 되살리지 않는다.
  if last_action is distinct from 'hide' then
    raise exception '관리자가 숨긴 글만 되살릴 수 있습니다' using errcode = '42501';
  end if;
  update public.posts set deleted_at = null where id = target and deleted_at is not null;
  insert into public.moderation_actions (post_id, action, actor_id)
  values (target, 'restore', public.current_account_id());
end;
$$;

-- 글 관리 화면용 목록. 숨긴 글도 보여야 되살릴 수 있다 — posts_public 은 못 쓴다.
-- 작성자가 스스로 지운 글은 보여주지 않는다. 관리자가 볼 이유가 없다.
create or replace function public.admin_recent_posts(before timestamptz default null, lim int default 30)
returns table (
  id uuid, type public.post_type, author_handle text, author_name text, author_kind public.account_kind,
  body text, title text, created_at timestamptz, like_count int, comment_count int,
  hidden boolean, hidden_reason text
)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.type, a.handle, a.name, a.kind,
         left(p.body, 200), p.payload->>'title', p.created_at, p.like_count, p.comment_count,
         (m.action = 'hide'), case when m.action = 'hide' then m.reason end
  from public.posts p
  join public.accounts a on a.id = p.author_id
  left join lateral (
    select action, reason from public.moderation_actions x
    where x.post_id = p.id order by x.created_at desc, x.id desc limit 1
  ) m on true
  where public.is_admin()
    and p.parent_id is null
    and (p.deleted_at is null or m.action = 'hide')
    and (before is null or p.created_at < before)
  order by p.created_at desc
  limit least(greatest(lim, 1), 100);
$$;

revoke all on function public.admin_hide_post(uuid, text) from public, anon;
revoke all on function public.admin_restore_post(uuid) from public, anon;
revoke all on function public.admin_recent_posts(timestamptz, int) from public, anon;
grant execute on function public.admin_hide_post(uuid, text) to authenticated;
grant execute on function public.admin_restore_post(uuid) to authenticated;
grant execute on function public.admin_recent_posts(timestamptz, int) to authenticated;

-- 2026-09-25 에 손으로 내린 28초 쇼츠. 관리자 기록이 없으면 되살리기가 막히므로 남겨 둔다.
insert into public.moderation_actions (post_id, action, reason, actor_id)
select id, 'hide', '28초 쇼츠가 경기 영상으로 올라감', null
from public.posts where id = '708bc6eb-1e7e-417c-93a4-b6f351736538' and deleted_at is not null;


-- ─────────────────────────────────────────────────────────────
-- 첫 관리자. 계정이 하나뿐이던 때(2026-09-25)의 운영자 계정이다.
-- ─────────────────────────────────────────────────────────────
insert into public.admins (account_id)
select id from public.accounts where handle = 'hootennis' and kind = 'user' and deleted_at is null
on conflict do nothing;
