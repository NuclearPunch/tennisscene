-- 검색어 하나가 아니라 여러 개를 받는다.
--
-- 같은 부서인데 단체마다 이름이 달라서 못 찾는 일이 있었다 —
-- `마스터즈부` 영상 11건과 `마스터스부` 결과 6건이 서로 안 보였다.
-- 어느 이름이 같은지는 앱(`src/lib/divisions.ts`)이 안다. DB 는 받은 걸 다 찾기만 한다.
--
-- 인자 타입이 바뀌므로 create or replace 로는 안 되고 먼저 지워야 한다.
drop function if exists public.search_posts(text, int);

create or replace function public.search_posts(qs text[], lim int default 20)
returns setof public.posts_public
language sql
stable
security invoker
set search_path = public
as $$
  with needle as (
    -- ilike 의 와일드카드를 막는다. 검색어에 든 %, _ 는 글자 그대로 찾아야 한다.
    select '%' || replace(replace(replace(btrim(raw), '\', '\\'), '%', '\%'), '_', '\_') || '%' as pat
    from unnest(qs) as t(raw)
    where length(btrim(raw)) >= 2
  )
  select p.*
  from public.posts_public p
  where p.parent_id is null
    -- exists 로 건다. 조인하면 검색어 두 개에 걸린 글이 두 번 나온다.
    and exists (
      select 1 from needle n
      where coalesce(p.body, '') ilike n.pat escape '\'
         or coalesce(p.payload->>'title', '') ilike n.pat escape '\'
         or coalesce(p.payload->>'tournamentName', '') ilike n.pat escape '\'
         or coalesce(p.payload->>'division', '') ilike n.pat escape '\'
         -- 선수 이름과 소속. 화면에 보이는 것은 찾을 수 있어야 한다.
         or jsonb_path_query_array(p.payload, '$.**.name')::text ilike n.pat escape '\'
         or jsonb_path_query_array(p.payload, '$.**.club')::text ilike n.pat escape '\'
    )
  order by p.created_at desc
  limit least(greatest(lim, 1), 50);
$$;

comment on function public.search_posts(text[], int) is
  '피드 검색. 여러 검색어 중 하나라도 걸리면 나온다. 부서 이름 확장은 src/lib/divisions.ts 참고.';

revoke all on function public.search_posts(text[], int) from public;
grant execute on function public.search_posts(text[], int) to anon, authenticated;
