-- 테니스씬 기반 스키마 · 7/8 — 권한 · RLS · 공개 읽기 뷰
--
-- 원칙: **비회원도 피드를 읽는다.** 관전자가 최대 집단이고, 읽기를 막으면 유입이 끊긴다.
-- 쓰기만 인증을 요구한다.
--
-- Supabase 는 public 스키마의 새 테이블에 anon/authenticated 로 기본 권한을 뿌린다
-- (alter default privileges). 그래서 컬럼 단위로 조이려면 먼저 통째로 revoke 하고
-- 필요한 것만 다시 grant 해야 한다. 아래가 전부 그 패턴이다.
--
-- PostgreSQL 은 테이블 단위 GRANT 에서 일부 컬럼만 REVOKE 할 수 없다.
-- 그래서 posts/accounts 는 테이블 단위 select 를 주지 않고 컬럼 단위로만 준다.

-- ─────────────────────────────────────────────────────────────
-- accounts
-- ─────────────────────────────────────────────────────────────
alter table public.accounts enable row level security;

revoke all on public.accounts from anon, authenticated;

-- auth_user_id 는 빼고 준다. 계정 ↔ 인증 사용자 연결은 밖에 노출할 이유가 없다.
grant select (id, kind, handle, name, bio, icon, initial, tone, created_at, updated_at, deleted_at)
  on public.accounts to anon, authenticated;
-- id 는 기본값('u_' + uuid)에 맡긴다. 클라이언트가 'b_rank' 같은 봇 키를 직접 못 적게.
grant insert (auth_user_id, kind, handle, name, bio, icon, initial, tone)
  on public.accounts to authenticated;
grant update (name, bio, icon, initial, tone, deleted_at) on public.accounts to authenticated;

create policy accounts_public_read on public.accounts
  for select to anon, authenticated
  using (deleted_at is null);

-- 가입 시 자기 계정 한 줄. 봇·브랜드는 service_role 로만 만든다.
create policy accounts_insert_self on public.accounts
  for insert to authenticated
  with check (auth_user_id = auth.uid() and kind = 'user');

create policy accounts_update_self on public.accounts
  for update to authenticated
  using (auth_user_id = auth.uid())
  with check (auth_user_id = auth.uid() and kind = 'user');


-- ─────────────────────────────────────────────────────────────
-- posts
--
-- 익명 글의 author_id 는 DB 에 그대로 남지만 밖으로 나가면 안 된다.
-- RLS 는 행 단위라 컬럼을 가릴 수 없으므로 두 겹으로 막는다.
--   1) anon/authenticated 에게 author_id 컬럼 select 권한을 아예 주지 않는다
--   2) 읽기는 posts_public 뷰로 하고, 뷰가 익명 글의 작성자를 null 로 바꿔 내보낸다
-- ─────────────────────────────────────────────────────────────
alter table public.posts enable row level security;

revoke all on public.posts from anon, authenticated;

grant select (
  id, type, body, payload, parent_id, quoted_post_id, is_anonymous,
  like_count, comment_count, repost_count, created_at, edited_at, deleted_at
) on public.posts to anon, authenticated;

-- 카운터 컬럼은 insert 권한에서도 뺀다. like_count=9999 로 들어오는 걸 막는다.
grant insert (author_id, type, body, payload, parent_id, quoted_post_id, is_anonymous)
  on public.posts to authenticated;
grant update (body, payload, edited_at, deleted_at) on public.posts to authenticated;

create policy posts_public_read on public.posts
  for select to anon, authenticated
  using (deleted_at is null);

create policy posts_insert_own on public.posts
  for insert to authenticated
  with check (
    author_id = public.current_account_id()
    and deleted_at is null
    -- 자동 발행 타입은 봇만 만든다. 유저는 본문 글과 댓글만.
    and type = 'text'
  );

-- 삭제는 hard delete 가 아니라 deleted_at 을 채우는 update 로 한다.
create policy posts_update_own on public.posts
  for update to authenticated
  using (author_id = public.current_account_id())
  with check (author_id = public.current_account_id());


-- 카운터는 트리거만 건드린다. 클라이언트가 직접 못 올리게 컬럼 권한에서 이미 빠져 있고,
-- 혹시 몰라 명시해 둔다: like_count/comment_count/repost_count 는 update 권한이 없다.


-- ─────────────────────────────────────────────────────────────
-- posts_public — 피드/댓글이 읽는 뷰
--
-- 소유자 권한으로 돈다(security_invoker = off). 일부러 그렇게 둔다:
--   · 익명 글의 author_id 를 가리려면 밑단 테이블의 author_id 를 읽어야 한다
--   · 비회원 읽기가 목적이라 RLS 를 한 번 더 통과시킬 이유가 없다
-- 대신 삭제·차단 필터를 뷰 안에서 직접 건다. (PostgreSQL 15+ 필요)
-- ─────────────────────────────────────────────────────────────
create view public.posts_public
with (security_invoker = off)
as
select
  p.id,
  p.type,
  p.body,
  p.payload,
  p.parent_id,
  p.quoted_post_id,
  p.is_anonymous,
  p.like_count,
  p.comment_count,
  p.repost_count,
  p.created_at,
  p.edited_at,

  -- 익명이면 작성자 정보를 통째로 비운다. 화면은 '익명'으로 그린다.
  case when p.is_anonymous then null else p.author_id end                   as author_id,
  case when p.is_anonymous then null
       when a.deleted_at is not null then null
       else a.handle end                                                    as author_handle,
  case when p.is_anonymous then null
       when a.deleted_at is not null then '탈퇴한 사용자'
       else a.name end                                                      as author_name,
  case when p.is_anonymous then 'user'::public.account_kind else a.kind end as author_kind,
  case when p.is_anonymous then null else a.icon end                        as author_icon,
  case when p.is_anonymous then null else a.initial end                     as author_initial,
  case when p.is_anonymous then 'neutral'::public.avatar_tone else a.tone end as author_tone
from public.posts p
join public.accounts a on a.id = p.author_id
where p.deleted_at is null
  -- 차단은 양방향으로 가린다. 차단한 쪽도 차단당한 쪽도 서로 안 보인다.
  --
  -- 단 익명 글에는 차단을 적용하지 않는다. 적용하면 이 뷰가 익명 작성자를 역추적하는
  -- 오라클이 된다 — 계정을 하나씩 차단·해제하며 어떤 익명 글이 사라지는지 보면
  -- 작성자를 특정할 수 있고, 피해자 쪽엔 흔적이 남지 않는다. 차단과 익명은 둘 다
  -- 가질 수 없어서 익명을 지키기로 했다(docs/DECISIONS.md).
  -- 지속적 괴롭힘은 차단이 아니라 신고·제재로 막는다.
  and (
    p.is_anonymous
    or not exists (
      select 1
      from public.blocks b
      where (b.blocker_id = public.current_account_id() and b.blocked_id = p.author_id)
         or (b.blocked_id = public.current_account_id() and b.blocker_id = p.author_id)
    )
  );

comment on view public.posts_public is
  '피드·댓글 읽기 경로. 익명 글의 작성자와 탈퇴 계정을 가리고, 삭제·차단을 걸러낸다. '
  '차단은 익명 글에 적용하지 않는다(역추적 방지). 비회원(anon)도 읽을 수 있다.';

-- Supabase 기본 권한이 뷰에도 뿌려지므로 명시적으로 걷어내고 select 만 다시 준다.
revoke all on public.posts_public from public, anon, authenticated;
grant select on public.posts_public to anon, authenticated;


-- ─────────────────────────────────────────────────────────────
-- 수집 테이블 — 읽기는 전부 공개, 쓰기는 수집 잡(service_role)만
-- service_role 은 RLS 를 우회하므로 정책을 따로 쓰지 않는다.
-- ─────────────────────────────────────────────────────────────
alter table public.ranking_snapshots enable row level security;
revoke all on public.ranking_snapshots from anon, authenticated;
grant select on public.ranking_snapshots to anon, authenticated;
create policy ranking_snapshots_public_read on public.ranking_snapshots
  for select to anon, authenticated using (true);


-- ─────────────────────────────────────────────────────────────
-- suppressed_players — 이름 비공개가 승인된 선수.
-- 읽기는 공개(뷰가 써야 한다), 쓰기는 운영(service_role)만.
-- 어떤 선수가 억제됐는지 자체는 비밀이 아니다. 이름을 안 보여주는 게 목적이다.
-- ─────────────────────────────────────────────────────────────
alter table public.suppressed_players enable row level security;
revoke all on public.suppressed_players from anon, authenticated;
grant select on public.suppressed_players to anon, authenticated;
create policy suppressed_players_public_read on public.suppressed_players
  for select to anon, authenticated using (true);


-- ─────────────────────────────────────────────────────────────
-- ranking_snapshots_public — 억제된 선수의 이름을 가린 읽기 경로.
-- 화면과 API 는 base 테이블이 아니라 이 뷰를 쓴다.
--
-- 이미 발행된 posts.payload jsonb 안의 이름은 여기서 못 가린다.
-- 그건 게시 잡이 발행 전에 거르고(suppressed 면 아예 안 올린다),
-- 이미 나간 포스트는 소급 마스킹 잡이 처리한다 (B-5.2).
-- ─────────────────────────────────────────────────────────────
create view public.ranking_snapshots_public
with (security_invoker = off)
as
select
  r.org,
  r.division,
  r.week,
  r.player_key,
  case when s.player_key is null then r.player_name else '비공개' end as player_name,
  case when s.player_key is null then r.club else null end            as club,
  r.rank,
  r.points,
  r.collected_at,
  (s.player_key is not null) as is_suppressed
from public.ranking_snapshots r
left join public.suppressed_players s
  on s.org = r.org and s.player_key = r.player_key;

comment on view public.ranking_snapshots_public is
  '랭킹 읽기 경로. 이름 비공개가 승인된 선수의 이름과 소속을 가린다.';

revoke all on public.ranking_snapshots_public from public, anon, authenticated;
grant select on public.ranking_snapshots_public to anon, authenticated;

alter table public.tournaments enable row level security;
revoke all on public.tournaments from anon, authenticated;
grant select on public.tournaments to anon, authenticated;
create policy tournaments_public_read on public.tournaments
  for select to anon, authenticated using (true);

alter table public.videos enable row level security;
revoke all on public.videos from anon, authenticated;
grant select on public.videos to anon, authenticated;
create policy videos_public_read on public.videos
  for select to anon, authenticated using (true);


-- ─────────────────────────────────────────────────────────────
-- likes · reposts · follows — 읽기 공개, 쓰기는 본인 것만
-- ─────────────────────────────────────────────────────────────
alter table public.likes enable row level security;
revoke all on public.likes from anon, authenticated;
grant select on public.likes to anon, authenticated;
grant insert, delete on public.likes to authenticated;
create policy likes_public_read on public.likes
  for select to anon, authenticated using (true);
create policy likes_insert_own on public.likes
  for insert to authenticated
  with check (account_id = public.current_account_id());
create policy likes_delete_own on public.likes
  for delete to authenticated
  using (account_id = public.current_account_id());

alter table public.reposts enable row level security;
revoke all on public.reposts from anon, authenticated;
grant select on public.reposts to anon, authenticated;
grant insert, delete on public.reposts to authenticated;
create policy reposts_public_read on public.reposts
  for select to anon, authenticated using (true);
create policy reposts_insert_own on public.reposts
  for insert to authenticated
  with check (account_id = public.current_account_id());
create policy reposts_delete_own on public.reposts
  for delete to authenticated
  using (account_id = public.current_account_id());

alter table public.follows enable row level security;
revoke all on public.follows from anon, authenticated;
grant select on public.follows to anon, authenticated;
grant insert, delete on public.follows to authenticated;
create policy follows_public_read on public.follows
  for select to anon, authenticated using (true);
create policy follows_insert_own on public.follows
  for insert to authenticated
  with check (follower_id = public.current_account_id());
create policy follows_delete_own on public.follows
  for delete to authenticated
  using (follower_id = public.current_account_id());


-- ─────────────────────────────────────────────────────────────
-- blocks — 공개하지 않는다. 누가 누굴 차단했는지는 본인만 본다.
-- ─────────────────────────────────────────────────────────────
alter table public.blocks enable row level security;
revoke all on public.blocks from anon, authenticated;
grant select, insert, delete on public.blocks to authenticated;
create policy blocks_read_own on public.blocks
  for select to authenticated
  using (blocker_id = public.current_account_id());
create policy blocks_insert_own on public.blocks
  for insert to authenticated
  with check (blocker_id = public.current_account_id());
create policy blocks_delete_own on public.blocks
  for delete to authenticated
  using (blocker_id = public.current_account_id());


-- ─────────────────────────────────────────────────────────────
-- reports — 접수는 회원만, 열람은 자기가 낸 것만.
-- 처리(status 변경)는 service_role.
-- ─────────────────────────────────────────────────────────────
alter table public.reports enable row level security;
revoke all on public.reports from anon, authenticated;
grant select (id, target_post_id, target_account_id, reason, status, created_at, resolved_at)
  on public.reports to authenticated;
-- 컬럼을 한정해서 준다. 테이블 전체 insert 를 주면 신고자가 status='dismissed' 와
-- resolution_note 를 직접 써넣을 수 있고, reports_open_idx 가 status='open' 부분
-- 인덱스라 그 신고는 운영 큐에 영영 안 뜬다. 바로 아래 name_removal_requests 와 같은 패턴.
grant insert (reporter_id, target_post_id, target_account_id, reason, detail)
  on public.reports to authenticated;
create policy reports_read_own on public.reports
  for select to authenticated
  using (reporter_id = public.current_account_id());
create policy reports_insert_own on public.reports
  for insert to authenticated
  with check (
    reporter_id = public.current_account_id()
    and status = 'open'
  );


-- ─────────────────────────────────────────────────────────────
-- name_removal_requests
-- 접수는 비회원도 할 수 있어야 한다 — 요청하는 선수가 우리 회원일 이유가 없다.
-- 읽기는 아무에게도 주지 않는다. 연락처가 들어 있다. 운영(service_role)만 본다.
-- insert 만 있고 select 가 없으므로 PostgREST 호출은 `Prefer: return=minimal` 이 필요하다.
-- ─────────────────────────────────────────────────────────────
alter table public.name_removal_requests enable row level security;
revoke all on public.name_removal_requests from anon, authenticated;
grant insert (player_name, club, org, division, player_key, contact, requester_id, message)
  on public.name_removal_requests to anon, authenticated;
create policy name_removal_insert_any on public.name_removal_requests
  for insert to anon, authenticated
  with check (
    status = 'received'
    -- 로그인 상태면 자기 계정으로만 적을 수 있다. 남의 이름을 빌릴 수 없다.
    and (requester_id is null or requester_id = public.current_account_id())
  );
