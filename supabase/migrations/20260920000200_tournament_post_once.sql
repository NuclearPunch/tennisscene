-- ─────────────────────────────────────────────────────────────
-- 대회 하나당 포스트 하나.
--
-- 대회는 접수 시작부터 종료까지 몇 달을 산다. 게시 잡이 매주 돌면서
-- 같은 대회를 계속 올리면 피드가 같은 대회로 도배된다.
-- 접수가 열릴 때 한 번만 올리고, 그 뒤로는 DB 가 막는다.
-- ─────────────────────────────────────────────────────────────
create unique index posts_tournament_once_idx
  on public.posts ((payload ->> 'org'), (payload ->> 'sourceId'))
  where type = 'tournament' and deleted_at is null;

comment on index public.posts_tournament_once_idx is
  '대회당 포스트 1개. 접수가 열릴 때 한 번만 올린다.';
