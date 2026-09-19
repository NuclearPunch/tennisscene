-- 테니스씬 기반 스키마 · 3/8 — posts
--
-- 피드에 뜨는 모든 것이 이 테이블 한 행이다. 봇 랭킹 포스트도, 유저 잡담도, 댓글도.
-- 타입별로 테이블을 쪼개면 "시간순 단일 피드"가 7-way UNION 이 되고 커서 페이지네이션이 깨진다.

create table public.posts (
  id              uuid primary key default gen_random_uuid(),

  -- 익명 글이어도 author_id 는 반드시 남는다. 제재가 가능해야 한다.
  -- 익명 처리는 읽기 경로(posts_public 뷰 + 컬럼 권한)에서만 한다.
  author_id       text not null references public.accounts (id) on delete cascade,

  type            public.post_type not null default 'text',
  body            text check (char_length(body) <= 500),

  -- 타입별 첨부 본문. 화면 라벨(상대시간·'09.24 (수)' 같은 것)은 여기 넣지 않는다.
  -- 저장은 원본 값, 표기는 조회 시점에 만든다. 안 그러면 "3일 남음"이 박제된다.
  payload         jsonb,

  -- 댓글. 1단계만 허용한다 — 대댓글 금지는 아래 트리거가 강제한다.
  parent_id       uuid references public.posts (id) on delete cascade,

  -- 인용 리포스트.
  quoted_post_id  uuid references public.posts (id) on delete set null,

  -- 표시만 익명. author_id 는 위에 그대로 남아 있다.
  is_anonymous    boolean not null default false,

  -- 비정규화 카운터. 시간순 피드에서 포스트마다 count(*) 를 돌리면 바로 느려진다.
  -- 아래 트리거들이 유지한다. 애플리케이션에서 직접 쓰지 않는다.
  like_count      integer not null default 0 check (like_count >= 0),
  comment_count   integer not null default 0 check (comment_count >= 0),
  repost_count    integer not null default 0 check (repost_count >= 0),

  created_at      timestamptz not null default now(),
  edited_at       timestamptz,
  deleted_at      timestamptz,

  -- 댓글은 본문 글만 된다. 댓글에 랭킹 카드를 붙일 일이 없다.
  constraint posts_comment_is_text check (parent_id is null or type = 'text'),

  -- text 는 payload 가 없고, 나머지 타입은 payload 가 반드시 있다.
  constraint posts_payload_matches_type check (
    case when type = 'text' then payload is null else payload is not null end
  ),

  -- 본문도 첨부도 없는 빈 포스트 금지.
  constraint posts_not_empty check (body is not null or payload is not null),

  -- 인용 리포스트는 실명만. 확산에는 책임이 필요하다 (docs/DECISIONS.md).
  constraint posts_quote_requires_identity check (
    quoted_post_id is null or is_anonymous = false
  ),

  constraint posts_no_self_parent check (parent_id is null or parent_id <> id),
  constraint posts_no_self_quote check (quoted_post_id is null or quoted_post_id <> id)
);

comment on table public.posts is
  '단일 포스트 테이블. type + payload 로 분기하고 타입별 테이블을 만들지 않는다.';
comment on column public.posts.author_id is
  '익명 글도 반드시 채워진다. 표시 익명일 뿐 내부적으로는 항상 계정에 귀속된다.';
comment on column public.posts.payload is
  'type 별 첨부 원본. src/lib/types.ts 의 PostPayload 유니온과 대응한다.';
comment on column public.posts.parent_id is
  '댓글의 부모. 1단계만 허용 — posts_enforce_reply_depth 트리거가 대댓글을 거부한다.';


-- ─────────────────────────────────────────────────────────────
-- 댓글 깊이 1단계 강제
-- 부모가 이미 댓글이면(parent_id 가 있으면) 거부한다.
-- CHECK 로는 다른 행을 봐야 해서 불가능하므로 트리거로 막는다.
-- ─────────────────────────────────────────────────────────────
create or replace function public.posts_enforce_reply_depth()
returns trigger
language plpgsql
as $$
declare
  parent_parent_id uuid;
begin
  if new.parent_id is not null then
    select p.parent_id
      into parent_parent_id
    from public.posts p
    where p.id = new.parent_id;

    if not found then
      raise exception '부모 포스트 %를 찾을 수 없다', new.parent_id
        using errcode = 'foreign_key_violation';
    end if;

    if parent_parent_id is not null then
      raise exception '댓글에는 답글을 달 수 없다 (1단계만 허용). parent_id=%', new.parent_id
        using errcode = 'check_violation';
    end if;
  end if;

  return new;
end;
$$;

create trigger posts_enforce_reply_depth
  before insert on public.posts
  for each row execute function public.posts_enforce_reply_depth();


-- ─────────────────────────────────────────────────────────────
-- parent_id · quoted_post_id 는 불변이다.
--
-- 위 트리거는 "새 부모가 댓글인지"만 본다. 자식이 달린 루트 글을 나중에 댓글로
-- 강등하면 depth 2 가 생기고, 카운터 트리거는 update of deleted_at 에만 걸려 있어
-- 부모가 바뀐 걸 모른다. 일반 유저는 이 컬럼에 update 권한이 없지만 RLS 를 우회하는
-- service_role(게시 잡·운영 쿼리)은 밟을 수 있다. 아예 못 바꾸게 막는다.
-- ─────────────────────────────────────────────────────────────
create or replace function public.posts_freeze_links()
returns trigger
language plpgsql
as $$
begin
  if new.parent_id is distinct from old.parent_id then
    raise exception 'parent_id 는 바꿀 수 없다 (post %)', old.id
      using errcode = 'check_violation';
  end if;

  if new.quoted_post_id is distinct from old.quoted_post_id then
    raise exception 'quoted_post_id 는 바꿀 수 없다 (post %)', old.id
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger posts_freeze_links
  before update on public.posts
  for each row execute function public.posts_freeze_links();


-- ─────────────────────────────────────────────────────────────
-- 카운터 트리거
-- comment_count = 살아있는 자식 댓글 수
-- repost_count  = reposts 행 수 + 살아있는 인용 포스트 수
-- like_count    = likes 행 수
--
-- 아래 update 문들은 deleted_at 을 SET 목록에 넣지 않으므로
-- `update of deleted_at` 트리거를 다시 깨우지 않는다. 재귀가 생기지 않는다.
-- ─────────────────────────────────────────────────────────────
create or replace function public.posts_sync_counters()
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
    if new.deleted_at is not null then
      return null;
    end if;
    if new.parent_id is not null then
      update public.posts set comment_count = comment_count + 1 where id = new.parent_id;
    end if;
    if new.quoted_post_id is not null then
      update public.posts set repost_count = repost_count + 1 where id = new.quoted_post_id;
    end if;

  elsif tg_op = 'DELETE' then
    if old.deleted_at is not null then
      return null;
    end if;
    if old.parent_id is not null then
      update public.posts set comment_count = greatest(comment_count - 1, 0) where id = old.parent_id;
    end if;
    if old.quoted_post_id is not null then
      update public.posts set repost_count = greatest(repost_count - 1, 0) where id = old.quoted_post_id;
    end if;

  else -- UPDATE of deleted_at
    if old.deleted_at is null and new.deleted_at is not null then
      if new.parent_id is not null then
        update public.posts set comment_count = greatest(comment_count - 1, 0) where id = new.parent_id;
      end if;
      if new.quoted_post_id is not null then
        update public.posts set repost_count = greatest(repost_count - 1, 0) where id = new.quoted_post_id;
      end if;
    elsif old.deleted_at is not null and new.deleted_at is null then
      if new.parent_id is not null then
        update public.posts set comment_count = comment_count + 1 where id = new.parent_id;
      end if;
      if new.quoted_post_id is not null then
        update public.posts set repost_count = repost_count + 1 where id = new.quoted_post_id;
      end if;
    end if;
  end if;

  return null;
end;
$$;

create trigger posts_sync_counters_ins
  after insert on public.posts
  for each row execute function public.posts_sync_counters();

create trigger posts_sync_counters_del
  after delete on public.posts
  for each row execute function public.posts_sync_counters();

create trigger posts_sync_counters_upd
  after update of deleted_at on public.posts
  for each row execute function public.posts_sync_counters();


-- ─────────────────────────────────────────────────────────────
-- 인덱스
-- ─────────────────────────────────────────────────────────────

-- 시간순 피드 (커서 = (created_at, id) 키셋 페이지네이션). 댓글은 피드에 안 뜬다.
create index posts_feed_idx
  on public.posts (created_at desc, id desc)
  where parent_id is null and deleted_at is null;

-- 타입 필터 (봇 3연속 방지 믹싱, 타입별 조회)
create index posts_type_feed_idx
  on public.posts (type, created_at desc, id desc)
  where parent_id is null and deleted_at is null;

-- 프로필 탭 / 계정별 조회
create index posts_author_idx
  on public.posts (author_id, created_at desc)
  where deleted_at is null;

-- 댓글 목록
create index posts_parent_idx
  on public.posts (parent_id, created_at)
  where parent_id is not null and deleted_at is null;

-- 인용 역참조
create index posts_quoted_idx
  on public.posts (quoted_post_id)
  where quoted_post_id is not null;

-- payload 내부 조회 (예: 특정 대회·선수가 들어간 포스트)
create index posts_payload_gin
  on public.posts using gin (payload jsonb_path_ops);
