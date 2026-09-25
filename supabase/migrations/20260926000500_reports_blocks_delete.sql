-- 신고 · 차단 · 탈퇴 — 앱스토어 심사 필수 항목 (애플 1.2 사용자 글, 5.1.1(v) 계정 삭제)
--
-- 테이블(reports · blocks)은 1차에 만들어 두었고 접수·저장 규칙도 있다.
-- 여기서는 그 위에 **처리 흐름**을 얹는다:
--   · 신고가 기준에 차면 자동으로 가린다 (익명 2건, 실명 3건 — 1차 설계 때 정한 값)
--   · 관리자가 신고 큐를 보고 "내림 확정" 또는 "문제없음(되살림)" 을 고른다
--   · 차단은 아이디(handle)로 한다 — 화면은 계정 ID 를 모른다(익명 글을 역추적 못 하게)
--   · 탈퇴는 앱 안에서 바로 된다. 로그인 정보까지 지운다


-- ─────────────────────────────────────────────────────────────
-- 신고 접수
--
-- 신고자는 DB 가 정한다(current_account_id). 화면이 남의 이름으로 신고할 수 없다.
-- 같은 사람이 같은 글을 두 번 신고해도 한 건이다 — 기존 부분 유니크 인덱스가 막는다.
--
-- security definer 인 이유: 중복을 조용히 넘기는 on conflict 가 reporter_id 를 읽을 권한을
-- 요구하는데, 신고자 칸은 일부러 읽기 권한을 안 줬다(누가 신고했는지 새면 안 된다).
-- 그 권한을 푸는 대신 이 함수가 대신 넣는다. 넣는 신고자는 호출한 본인 하나뿐이다.
-- ─────────────────────────────────────────────────────────────
create or replace function public.report_post(target uuid, why text, more text default null)
returns boolean  -- 새로 접수됐으면 true, 이미 신고한 글이면 false
language plpgsql
security definer
set search_path = public
as $$
declare
  me text := public.current_account_id();
  n int;
begin
  if me is null then
    raise exception '로그인이 필요합니다' using errcode = '42501';
  end if;
  if coalesce(btrim(why), '') = '' then
    raise exception '신고 사유를 골라주세요' using errcode = '22023';
  end if;
  insert into public.reports (reporter_id, target_post_id, reason, detail)
  values (me, target, left(btrim(why), 500), nullif(left(btrim(coalesce(more, '')), 1000), ''))
  on conflict (reporter_id, target_post_id) where target_post_id is not null do nothing;
  get diagnostics n = row_count;
  return n > 0;
end;
$$;

revoke all on function public.report_post(uuid, text, text) from public, anon;
grant execute on function public.report_post(uuid, text, text) to authenticated;


-- ─────────────────────────────────────────────────────────────
-- 자동 블라인드
--
-- 익명 글은 2건, 실명 글은 3건. 익명은 책임지는 이름이 없어서 문턱을 낮춘다.
-- 가린 기록은 moderation_actions 에 '신고 N건 자동 블라인드' 로 남는다 —
-- 관리자가 "문제없음" 을 고르면 되살릴 수 있다(되살리기는 관리자가 숨긴 글만 된다).
--
-- security definer 인 이유: 신고자는 남의 글을 고칠 권한이 없다. 이 트리거만 대신 가린다.
-- ─────────────────────────────────────────────────────────────
create or replace function public.reports_auto_blind()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  anon boolean;
  live boolean;
  n int;
  need int;
begin
  if new.target_post_id is null then
    return new;
  end if;
  select is_anonymous, deleted_at is null into anon, live from public.posts where id = new.target_post_id;
  if not found or not live then
    return new;
  end if;
  select count(*) into n from public.reports
  where target_post_id = new.target_post_id and status in ('open', 'reviewing');
  need := case when anon then 2 else 3 end;
  if n >= need then
    update public.posts set deleted_at = now() where id = new.target_post_id and deleted_at is null;
    insert into public.moderation_actions (post_id, action, reason, actor_id)
    values (new.target_post_id, 'hide', format('신고 %s건 자동 블라인드', n), null);
  end if;
  return new;
end;
$$;

create trigger reports_auto_blind
  after insert on public.reports
  for each row execute function public.reports_auto_blind();


-- ─────────────────────────────────────────────────────────────
-- 관리자 신고 큐
--
-- 신고가 열려 있는 글만, 글마다 한 줄. 익명 글이어도 관리자에게는 실제 작성자를 보여준다 —
-- 반복해서 신고되는 사람을 알아야 한다. 이 함수는 관리자만 부를 수 있다.
-- ─────────────────────────────────────────────────────────────
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
         a.handle, a.name, a.kind, p.created_at,
         r.n, r.reasons, r.last_at,
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

/**
 * 처리. 'remove' 는 내림 확정(아직 안 가려졌으면 가린다), 'keep' 은 문제없음(자동으로 가려졌으면 되살린다).
 * 어느 쪽이든 그 글의 열린 신고를 닫는다.
 */
create or replace function public.admin_resolve_reports(target uuid, verdict text, note text default null)
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
  if verdict not in ('remove', 'keep') then
    raise exception '처리는 remove 또는 keep 입니다' using errcode = '22023';
  end if;

  if verdict = 'remove' then
    update public.posts set deleted_at = now() where id = target and deleted_at is null;
    if found then
      insert into public.moderation_actions (post_id, action, reason, actor_id)
      values (target, 'hide', coalesce(nullif(btrim(note), ''), '신고 확인 후 내림'), public.current_account_id());
    end if;
  else
    select action into last_action from public.moderation_actions
    where post_id = target order by created_at desc, id desc limit 1;
    -- 관리자(또는 자동 블라인드)가 가린 글만 되살린다. 작성자가 지운 글은 그대로 둔다.
    if last_action = 'hide' then
      update public.posts set deleted_at = null where id = target and deleted_at is not null;
      insert into public.moderation_actions (post_id, action, reason, actor_id)
      values (target, 'restore', coalesce(nullif(btrim(note), ''), '신고 확인 — 문제없음'), public.current_account_id());
    end if;
  end if;

  update public.reports
  set status = case when verdict = 'remove' then 'actioned' else 'dismissed' end::public.report_status,
      resolved_at = now(),
      resolution_note = nullif(btrim(note), '')
  where target_post_id = target and status in ('open', 'reviewing');
end;
$$;

revoke all on function public.admin_report_queue() from public, anon;
revoke all on function public.admin_resolve_reports(uuid, text, text) from public, anon;
grant execute on function public.admin_report_queue() to authenticated;
grant execute on function public.admin_resolve_reports(uuid, text, text) to authenticated;


-- ─────────────────────────────────────────────────────────────
-- 차단 — 아이디(handle)로
--
-- 화면은 계정 ID 를 모른다. 피드 뷰가 author_id 를 주지 않고 핸들만 준다 —
-- 익명 글은 핸들도 비어서 차단 대상이 될 수 없다(익명 역추적 방지, docs/DECISIONS.md).
-- security invoker 라 blocks 의 RLS(본인 것만)가 그대로 걸린다.
-- ─────────────────────────────────────────────────────────────
create or replace function public.block_handle(h text)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  me text := public.current_account_id();
  them text;
begin
  if me is null then
    raise exception '로그인이 필요합니다' using errcode = '42501';
  end if;
  select id into them from public.accounts where handle = lower(btrim(h)) and deleted_at is null;
  if them is null then
    raise exception '없는 계정입니다' using errcode = 'P0002';
  end if;
  if them = me then
    raise exception '나를 차단할 수는 없습니다' using errcode = '22023';
  end if;
  insert into public.blocks (blocker_id, blocked_id) values (me, them) on conflict do nothing;
end;
$$;

create or replace function public.unblock_handle(h text)
returns void
language sql
security invoker
set search_path = public
as $$
  delete from public.blocks
  where blocker_id = public.current_account_id()
    and blocked_id = (select id from public.accounts where handle = lower(btrim(h)));
$$;

/** 내가 차단한 계정들. 화면이 이 핸들들의 글을 가리고, 프로필에서 풀 수 있게 보여준다. */
create or replace function public.my_blocks()
returns table (handle text, name text, created_at timestamptz)
language sql
stable
security invoker
set search_path = public
as $$
  select a.handle, a.name, b.created_at
  from public.blocks b
  join public.accounts a on a.id = b.blocked_id
  where b.blocker_id = public.current_account_id()
  order by b.created_at desc;
$$;

revoke all on function public.block_handle(text) from public, anon;
revoke all on function public.unblock_handle(text) from public, anon;
revoke all on function public.my_blocks() from public, anon;
grant execute on function public.block_handle(text) to authenticated;
grant execute on function public.unblock_handle(text) to authenticated;
grant execute on function public.my_blocks() to authenticated;


-- ─────────────────────────────────────────────────────────────
-- 탈퇴 — 앱 안에서 바로 (애플 5.1.1(v))
--
-- 지우는 것: 로그인 정보(auth.users — 이메일·비밀번호), 쓴 글·댓글, 좋아요·리포스트·팔로우·차단.
-- 남기는 것: 계정 행 자체(soft delete) — 남긴 글의 author_id 가 끊기면 제재 이력이 사라진다.
--   이름·아이디는 '탈퇴한 사용자' / 'deleted_…' 로 바꿔서 누구였는지 알 수 없게 한다.
--   다른 사람이 낸 신고 기록도 남는다 — 운영 판단의 근거라서.
--
-- security definer 인 이유: auth.users 는 일반 롤이 지울 수 없다. service_role 을 앱에 두지 않으므로
-- 본인 것만 지우는 이 함수가 대신 지운다. 지우는 대상은 auth.uid() 하나뿐이다.
-- ─────────────────────────────────────────────────────────────
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

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
