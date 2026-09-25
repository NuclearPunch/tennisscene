-- 약관 동의 기록 · 이용 정지
--
-- 약관(/terms)에 "운영자가 이용을 제한할 수 있다" 고 적었다. 적은 건 실제로 할 수 있어야 한다.
-- 가입할 때 약관 동의를 받으므로 언제 동의했는지도 남긴다.

-- 동의 시각. 가입 화면이 동의 체크 없이는 넘어가지 않으므로, 프로필이 만들어진 시각이 곧 동의 시각이다.
-- 이 파일 이전에 만든 계정은 동의 기록이 없다(null) — 기본값을 나중에 걸어서 기존 행은 비워 둔다.
alter table public.accounts add column terms_agreed_at timestamptz;
alter table public.accounts alter column terms_agreed_at set default now();

-- 이용 정지. 정지된 회원은 글·댓글을 못 쓴다. 읽기와 탈퇴는 된다.
alter table public.accounts add column suspended_at timestamptz;
alter table public.accounts add column suspended_reason text check (char_length(suspended_reason) <= 300);

comment on column public.accounts.suspended_at is '운영자가 이용을 정지한 시각. 정지되면 글·댓글을 못 쓴다(posts_insert_own).';

create or replace function public.is_suspended()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select suspended_at is not null from public.accounts where id = public.current_account_id()), false);
$$;

revoke all on function public.is_suspended() from public, anon;
grant execute on function public.is_suspended() to authenticated;

drop policy posts_insert_own on public.posts;
create policy posts_insert_own on public.posts
  for insert to authenticated
  with check (
    author_id = public.current_account_id()
    and deleted_at is null
    -- 자동 발행 타입은 봇만 만든다. 유저는 본문 글과 댓글만.
    and type = 'text'
    -- 이용이 정지된 회원은 쓸 수 없다.
    and not public.is_suspended()
  );

/**
 * 글을 보고 그 작성자를 정지한다. 신고 큐에서 부른다 — 익명 글이어도 작성자를 안다.
 * 봇 계정은 정지하지 않는다(글만 내리면 된다). 정지하면서 그 사람의 보이는 글을 전부 내리지는 않는다 —
 * 문제 된 글은 신고 처리로 내리고, 나머지는 운영자가 따로 본다.
 */
create or replace function public.admin_suspend_author(target uuid, why text default null)
returns text   -- 정지한 계정의 아이디
language plpgsql
security definer
set search_path = public
as $$
declare
  who text;
  h text;
  k public.account_kind;
begin
  if not public.is_admin() then
    raise exception '관리자만 할 수 있습니다' using errcode = '42501';
  end if;
  select p.author_id, a.handle, a.kind into who, h, k
  from public.posts p join public.accounts a on a.id = p.author_id where p.id = target;
  if who is null then
    raise exception '없는 글입니다' using errcode = 'P0002';
  end if;
  if k <> 'user' then
    raise exception '자동 계정은 정지하지 않습니다. 글을 내려 주세요' using errcode = '22023';
  end if;
  if exists (select 1 from public.admins where account_id = who) then
    raise exception '관리자는 정지할 수 없습니다' using errcode = '22023';
  end if;
  update public.accounts
  set suspended_at = coalesce(suspended_at, now()),
      suspended_reason = coalesce(nullif(btrim(why), ''), suspended_reason, '신고 처리')
  where id = who;
  return h;
end;
$$;

create or replace function public.admin_unsuspend(h text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception '관리자만 할 수 있습니다' using errcode = '42501';
  end if;
  update public.accounts set suspended_at = null, suspended_reason = null where handle = lower(btrim(h));
end;
$$;

revoke all on function public.admin_suspend_author(uuid, text) from public, anon;
revoke all on function public.admin_unsuspend(text) from public, anon;
grant execute on function public.admin_suspend_author(uuid, text) to authenticated;
grant execute on function public.admin_unsuspend(text) to authenticated;

-- 신고 큐에 작성자가 이미 정지됐는지 보여준다.
create or replace function public.admin_report_queue()
returns table (
  post_id uuid, type public.post_type, body text, title text, is_anonymous boolean,
  author_handle text, author_name text, author_kind public.account_kind,
  created_at timestamptz, report_count int, reasons text[], last_reported_at timestamptz,
  hidden boolean, auto_hidden boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.type, left(p.body, 300), p.payload->>'title', p.is_anonymous,
         a.handle, a.name || case when a.suspended_at is not null then ' (정지됨)' else '' end, a.kind,
         p.created_at, r.n, r.reasons, r.last_at,
         p.deleted_at is not null,
         coalesce(m.reason like '신고 %자동 블라인드', false)
  from (
    select target_post_id, count(*)::int n, array_agg(distinct reason) reasons, max(created_at) last_at
    from public.reports
    where target_post_id is not null and status in ('open', 'reviewing')
    group by target_post_id
  ) r
  join public.posts p on p.id = r.target_post_id
  join public.accounts a on a.id = p.author_id
  left join lateral (
    select reason from public.moderation_actions x
    where x.post_id = p.id order by x.created_at desc, x.id desc limit 1
  ) m on true
  where public.is_admin()
  order by r.n desc, r.last_at desc;
$$;
