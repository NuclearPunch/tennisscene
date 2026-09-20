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
