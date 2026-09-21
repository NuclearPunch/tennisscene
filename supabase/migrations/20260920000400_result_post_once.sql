-- ─────────────────────────────────────────────────────────────
-- 대회 × 부서 하나당 결과 포스트 하나.
--
-- 결과는 부서별로 따로 올라온다 — 개나리부가 끝난 날 결과가 뜨고
-- 마스터스부는 사흘 뒤에 뜬다. 그래서 대회 단위가 아니라 부서 단위로 막는다.
-- 수집 잡은 진행 중·최근 종료 대회를 매일 다시 훑는다. 중복은 여기서 막힌다.
-- ─────────────────────────────────────────────────────────────
create unique index posts_result_once_idx
  on public.posts ((payload ->> 'org'), (payload ->> 'sourceId'), (payload ->> 'partCode'))
  where type = 'result' and deleted_at is null;

comment on index public.posts_result_once_idx is
  '대회 부서당 결과 포스트 1개. 결과는 부서별로 따로 확정된다.';
