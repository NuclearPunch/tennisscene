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
