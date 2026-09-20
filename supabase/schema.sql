-- 테니스씬 전체 스키마
-- supabase/migrations/*.sql 를 순서대로 합친 것이다. 생성물이니 직접 고치지 마라.
-- 다시 만들려면: npm run schema
--
-- Supabase 대시보드 → SQL Editor 에 통째로 붙여넣고 실행한다.
-- 한 번만 돌린다. 두 번 돌리면 create type / create table 에서 깨진다.


-- ═══ 20260918000100_enums.sql ════════════════════════════════════
-- 테니스씬 기반 스키마 · 1/8 — 열거형
--
-- 여기의 값은 src/lib/types.ts 의 유니온과 1:1 이다.
-- 한쪽만 바꾸면 계약이 깨진다. 값을 추가할 때는 양쪽을 같이 고친다.

-- 봇·브랜드·유저가 같은 accounts 테이블에 들어간다.
-- 공지 전용 테이블을 따로 두지 않는 이유: 봇 글에도 댓글·좋아요·인용이 달리고,
-- 그때 계정이 두 테이블로 쪼개져 있으면 posts.author_id 가 가리킬 곳이 없어진다.
create type public.account_kind as enum ('bot', 'brand', 'user');

-- 아바타 표시용. UI 가 소유하는 값이지만 계정 행에 붙어 다닌다.
create type public.avatar_tone as enum ('green', 'neutral', 'ball');
create type public.avatar_icon as enum ('weather', 'chart', 'play', 'calendar', 'box', 'ball');

-- posts 는 단일 테이블이고 type + payload 로 분기한다.
-- 타입별 테이블을 만들면 "시간순 단일 피드" 한 번에 7-way UNION 이 된다.
create type public.post_type as enum (
  'text',
  'ranking',
  'tournament',
  'video',
  'gear',
  'score',
  'weather'
);

create type public.report_status as enum ('open', 'reviewing', 'actioned', 'dismissed');

create type public.name_removal_status as enum ('received', 'verifying', 'approved', 'rejected', 'done');

-- ═══ 20260918000200_accounts.sql ═════════════════════════════════
-- 테니스씬 기반 스키마 · 2/8 — accounts
--
-- 봇 6개 · 브랜드 계정 · 사람 유저가 전부 이 테이블 한 곳에 들어간다.
-- 구분은 kind 컬럼 하나이고, 화면에서는 이름 옆 체크 배지 하나로만 드러난다.

create table public.accounts (
  -- id 가 uuid 가 아니라 text 인 이유:
  -- 봇·브랜드는 운영자가 고정으로 심는 계정이라 사람이 읽을 수 있는 안정적인 키가 필요하다.
  -- 게시 잡(scripts/publish.ts)이 'b_rank' 로 바로 찾아 쓰고, src/lib/accounts.ts 의
  -- 정의와 문자 그대로 일치한다. 사람 유저는 'u_' + uuid 를 기본값으로 받는다.
  id            text primary key default ('u_' || replace(gen_random_uuid()::text, '-', '')),

  -- 사람 유저만 채워진다. 봇·브랜드는 null.
  auth_user_id  uuid unique references auth.users (id) on delete set null,

  kind          public.account_kind not null,

  -- 소문자로만 저장한다. 대소문자만 다른 핸들이 두 개 생기면 사칭 통로가 된다.
  handle        text not null unique
                  check (handle = lower(handle) and handle ~ '^[a-z0-9_]{2,20}$'),
  name          text not null check (char_length(name) between 1 and 40),
  bio           text check (char_length(bio) <= 160),

  -- 봇·브랜드는 icon, 사람 유저는 initial 을 쓴다.
  icon          public.avatar_icon,
  initial       text check (char_length(initial) = 1),
  tone          public.avatar_tone not null default 'neutral',

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  -- 계정 탈퇴도 soft delete. 남긴 글의 author_id 가 끊기면 제재 이력이 사라진다.
  deleted_at    timestamptz,

  -- 사람 유저는 auth 계정에 묶여야 하고, 봇·브랜드는 묶이면 안 된다.
  --
  -- 단 탈퇴한 계정은 예외다. auth.users 에서 행이 지워지면 위의 on delete set null 이
  -- auth_user_id 를 null 로 바꾸는데, 예외가 없으면 그 UPDATE 가 이 제약에 걸려
  -- delete from auth.users 자체가 실패한다. 그러면 개인정보 삭제 요청을 처리할 수 없다.
  constraint accounts_auth_link_matches_kind check (
    (kind = 'user' and (auth_user_id is not null or deleted_at is not null)) or
    (kind <> 'user' and auth_user_id is null)
  )
);

comment on table public.accounts is
  '봇·브랜드·유저 공용 계정 테이블. 공지 전용 계정 테이블을 따로 만들지 않는다.';
comment on column public.accounts.id is
  '봇·브랜드는 b_*/br_* 고정 키, 사람 유저는 u_<uuid>. src/lib/accounts.ts 와 일치한다.';
comment on column public.accounts.auth_user_id is
  'auth.users 연결. 사람 유저만 값이 있다. anon/authenticated 에게는 컬럼 권한을 주지 않는다.';

create index accounts_kind_idx on public.accounts (kind) where deleted_at is null;

-- auth.uid() -> accounts.id 매핑. RLS 정책과 뷰에서 계속 쓴다.
-- accounts 의 auth_user_id 는 일반 롤에게 컬럼 권한이 없으므로 security definer 로 둔다.
create or replace function public.current_account_id()
returns text
language sql
stable
security definer
set search_path = public, auth
as $$
  select a.id
  from public.accounts a
  where a.auth_user_id = auth.uid()
    and a.deleted_at is null;
$$;

comment on function public.current_account_id() is
  '현재 요청의 auth.uid() 에 해당하는 accounts.id. 비회원이면 null.';

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger accounts_touch_updated_at
  before update on public.accounts
  for each row execute function public.touch_updated_at();

-- ═══ 20260918000300_posts.sql ════════════════════════════════════
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

-- ═══ 20260918000400_ranking_snapshots.sql ════════════════════════
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

-- ═══ 20260918000500_tournaments_videos.sql ═══════════════════════
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

-- ═══ 20260918000600_social_moderation.sql ════════════════════════
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

-- ═══ 20260918000700_rls.sql ══════════════════════════════════════
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

-- ═══ 20260918000800_seed_bots.sql ════════════════════════════════
-- 테니스씬 기반 스키마 · 8/8 — 봇 계정 시드
--
-- 여섯 개의 자동 발행 축. src/lib/accounts.ts 의 BOTS 와 id·handle·name·icon·tone 이
-- 문자 그대로 일치해야 한다. 한쪽만 고치면 게시 잡이 없는 계정을 찾는다.
--
-- 시드 데이터가 아니라 스키마의 일부로 본다 — 이 계정이 없으면 수집 파이프라인이 돌지 않는다.
-- 그래서 seed.sql 이 아니라 마이그레이션에 둔다. 재실행해도 안전하다.

insert into public.accounts (id, kind, handle, name, icon, tone) values
  ('b_today', 'bot', 'today', '오늘의 코트', 'weather',  'green'),
  ('b_rank',  'bot', 'rank',  '주간 랭킹',   'chart',    'green'),
  ('b_match', 'bot', 'match', '동호인 경기', 'play',     'green'),
  ('b_tour',  'bot', 'tour',  '대회 알림',   'calendar', 'green'),
  ('b_gear',  'bot', 'gear',  '장비',        'box',      'ball'),
  ('b_pro',   'bot', 'pro',   '프로 테니스', 'ball',     'green')
on conflict (id) do update set
  kind   = excluded.kind,
  handle = excluded.handle,
  name   = excluded.name,
  icon   = excluded.icon,
  tone   = excluded.tone,
  deleted_at = null;

-- ═══ 20260920000100_ranking_post_once.sql ════════════════════════
-- ─────────────────────────────────────────────────────────────
-- 같은 단체·부서·주차의 랭킹 포스트는 하나만.
--
-- 게시 잡이 두 번 돌거나 재실행되면 같은 주차 랭킹이 피드에 두 번 뜬다.
-- 애플리케이션에서 "이미 있나" 확인하는 것만으로는 동시 실행을 못 막는다.
-- DB 가 거부해야 확실하다.
-- ─────────────────────────────────────────────────────────────
create unique index posts_ranking_once_idx
  on public.posts (
    (payload ->> 'org'),
    (payload ->> 'division'),
    (payload ->> 'week')
  )
  where type = 'ranking' and deleted_at is null;

comment on index public.posts_ranking_once_idx is
  '단체×부서×주차당 랭킹 포스트 1개. 게시 잡 재실행 시 중복을 DB 가 막는다.';
