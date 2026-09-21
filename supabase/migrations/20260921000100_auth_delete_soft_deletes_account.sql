-- ─────────────────────────────────────────────────────────────
-- auth.users 를 지우면 프로필도 함께 탈퇴 처리한다.
--
-- accounts.auth_user_id 는 `on delete set null` 이다. 그런데
-- accounts_auth_link_matches_kind 는 kind='user' 인 행의 auth_user_id 가 null 이 되는 걸
-- **deleted_at 이 채워져 있을 때만** 허용한다. 그래서 순서가 어긋나면
--
--     delete from auth.users where id = ...;
--     → UPDATE accounts SET auth_user_id = NULL
--     → 23514 check_violation
--
-- 로 삭제 자체가 막힌다. B-0.3 에서 제약에 예외를 더했지만, 그건 **이미 탈퇴 처리된**
-- 계정만 구제한다. 살아 있는 계정은 여전히 못 지운다.
--
-- 이게 왜 중요한가: 개인정보 삭제 요청이 오면 auth.users 를 지워야 한다.
-- 대시보드에서 유저를 지우는 건 운영자가 늘 하는 일인데, 지금은 알 수 없는 제약 오류로 실패한다.
--
-- 제약을 푸는 대신 **순서를 자동으로 맞춘다.** 계정은 여전히 soft delete 로 남아서
-- 남긴 글의 author_id 가 끊기지 않고 제재 이력도 보존된다.
-- ─────────────────────────────────────────────────────────────
create or replace function public.accounts_soft_delete_on_auth_removal()
returns trigger
language plpgsql
as $$
begin
  -- auth 연결이 끊기는 순간(= auth.users 행이 지워진 순간) 탈퇴로 본다.
  if old.auth_user_id is not null
     and new.auth_user_id is null
     and new.kind = 'user'
     and new.deleted_at is null
  then
    new.deleted_at := now();
  end if;
  return new;
end;
$$;

-- accounts_touch_updated_at 보다 먼저 돌 필요는 없다. 이름 순서로 정해지므로
-- 'a' 로 시작하는 이 트리거가 먼저 돌지만, 둘은 서로 간섭하지 않는다.
create trigger accounts_soft_delete_on_auth_removal
  before update of auth_user_id on public.accounts
  for each row execute function public.accounts_soft_delete_on_auth_removal();

comment on function public.accounts_soft_delete_on_auth_removal() is
  'auth.users 삭제 시 on delete set null 이 제약에 걸리지 않게 프로필을 함께 탈퇴 처리한다.';
