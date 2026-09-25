-- 푸시 알림 — 기기 토큰과 발송 기록
--
-- 알림 두 가지: 내 글에 댓글(바로), 월요일 주간 랭킹 발표(전체).
-- 토큰은 기기마다 하나다. 같은 폰으로 다른 사람이 로그인하면 토큰의 주인이 바뀐다 —
-- 앞사람 알림이 뒷사람에게 가면 안 된다. 로그아웃·탈퇴할 때 지운다.
--
-- 토큰은 남에게 보이면 안 된다(가지고 있으면 그 기기로 알림을 보낼 수 있다).
-- 그래서 읽기 권한을 아무에게도 주지 않고, 넣고 빼는 건 본인 것만 하는 함수로 한다.
-- 보내는 건 서버(직접 연결)만 한다.

create table public.push_tokens (
  token        text primary key check (token ~ '^(Expo|Exponent)PushToken\[.+\]$'),
  account_id   text not null references public.accounts (id) on delete cascade,
  platform     text check (platform in ('ios', 'android')),
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index push_tokens_account_idx on public.push_tokens (account_id);

alter table public.push_tokens enable row level security;
revoke all on public.push_tokens from public, anon, authenticated;

create or replace function public.register_push_token(t text, p text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  me text := public.current_account_id();
begin
  if me is null then
    raise exception '로그인이 필요합니다' using errcode = '42501';
  end if;
  insert into public.push_tokens (token, account_id, platform)
  values (t, me, p)
  on conflict (token) do update
    set account_id = excluded.account_id, platform = excluded.platform, last_seen_at = now();
end;
$$;

create or replace function public.unregister_push_token(t text)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.push_tokens where token = t and account_id = public.current_account_id();
$$;

revoke all on function public.register_push_token(text, text) from public, anon;
revoke all on function public.unregister_push_token(text) from public, anon;
grant execute on function public.register_push_token(text, text) to authenticated;
grant execute on function public.unregister_push_token(text) to authenticated;

-- 발송 영수증. Expo 는 보낸 뒤 결과(받는 기기가 없어졌는지)를 따로 알려준다.
-- 매일 크론이 확인하고, 기기가 없어졌으면 토큰을 지운다. 영수증은 24시간 뒤 사라지므로 하루 치만 둔다.
create table public.push_tickets (
  id          text primary key,
  token       text not null,
  created_at  timestamptz not null default now()
);

alter table public.push_tickets enable row level security;
revoke all on public.push_tickets from public, anon, authenticated;

-- 탈퇴하면 그 사람의 기기 토큰도 지운다. (000500 의 함수를 이 줄만 더해서 다시 만든다)
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  uid uuid := auth.uid();
  me text := public.current_account_id();
begin
  if uid is null then
    raise exception '로그인이 필요합니다' using errcode = '42501';
  end if;

  if me is not null then
    update public.posts set deleted_at = now() where author_id = me and deleted_at is null;
    delete from public.likes where account_id = me;
    delete from public.reposts where account_id = me;
    delete from public.follows where follower_id = me or followee_id = me;
    delete from public.blocks where blocker_id = me or blocked_id = me;
    -- 이 사람의 기기로 더 알림이 가지 않게.
    delete from public.push_tokens where account_id = me;
    update public.accounts
    set name = '탈퇴한 사용자',
        handle = 'deleted_' || substr(md5(id), 1, 10),
        bio = null,
        initial = '탈',
        deleted_at = now()
    where id = me;
  end if;

  -- 로그인 정보. accounts.auth_user_id 는 on delete set null 로 끊긴다.
  delete from auth.users where id = uid;
end;
$$;

