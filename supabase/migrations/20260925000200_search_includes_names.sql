-- ─────────────────────────────────────────────────────────────
-- 검색에 선수 이름과 소속을 넣는다.
--
-- 처음엔 본문·대회명·영상 제목·부서만 봤다. 그래서 **준우승·공동3위·2~10위 이름이
-- 안 걸렸다** — 본문에 들어가는 건 우승자와 1위뿐이기 때문이다.
-- 자기 이름을 쳐도 자기가 나온 글이 안 나오는 검색은 검색이 아니다.
--
-- 기준을 다시 잡는다:
--
--   **화면에 보이는 것은 찾을 수 있어야 한다. 한 번도 안 보여주는 것만 뺀다.**
--
-- 준우승·공동3위·2~10위는 카드를 펼치면 다 보인다. 스크롤하면 읽을 수 있는 걸
-- 검색으로 못 찾게 막는 건 보호가 아니라 불편이다.
--
-- 여전히 빼는 것 — `ranking_snapshots`. 우리는 부서별 상위 10명만 포스트로 올리는데
-- 스냅샷 테이블에는 250명이 들어 있다. 나머지 240명은 화면에 나온 적이 없다.
-- 그걸 이름으로 훑을 수 있게 되면 그게 선수 명부다(CLAUDE.md).
--
-- `$.**.name` 은 payload 어디에 있든 name 을 긁는다 — 랭킹의 leader·runnersUp,
-- 결과의 champion·runnerUp·semifinalists, 대회의 대회명. 영상 payload 엔 name 이 없고
-- 제목으로 이미 찾는다.
--
-- 비고: 이름이 나중에 비공개 승인되면 이미 나간 payload 엔 남는다(B-5.2 소급 마스킹 미구현).
-- 검색이 그걸 드러내지만 스크롤해도 똑같이 보인다 — 노출 범위가 늘지는 않는다.
-- ─────────────────────────────────────────────────────────────
create or replace function public.search_posts(q text, lim int default 20)
returns setof public.posts_public
language sql
stable
security invoker
set search_path = public
as $$
  with needle as (
    -- ILIKE 에서 % 와 _ 는 와일드카드다. 사용자가 친 글자 그대로 찾게 이스케이프한다.
    select '%' || replace(replace(replace(btrim(q), '\', '\\'), '%', '\%'), '_', '\_') || '%' as pat
  )
  select p.*
  from public.posts_public p, needle n
  where p.parent_id is null
    and length(btrim(q)) >= 2
    and (
      coalesce(p.body, '')                            ilike n.pat escape '\'
      or coalesce(p.payload ->> 'title', '')          ilike n.pat escape '\'
      or coalesce(p.payload ->> 'tournamentName', '') ilike n.pat escape '\'
      or coalesce(p.payload ->> 'division', '')       ilike n.pat escape '\'
      -- 카드에 그려지는 선수 이름과 소속. 대회 포스트에서는 대회명이 잡힌다.
      or jsonb_path_query_array(p.payload, '$.**.name')::text ilike n.pat escape '\'
      or jsonb_path_query_array(p.payload, '$.**.club')::text ilike n.pat escape '\'
    )
  order by p.created_at desc
  limit least(greatest(lim, 1), 50);
$$;

comment on function public.search_posts(text, int) is
  '피드 글 검색. 화면에 그려지는 것만 찾는다 — 본문·대회명·영상 제목·부서·선수 이름·소속. '
  'ranking_snapshots 는 보지 않는다. 거기엔 포스트로 올린 적 없는 240명이 더 있어서 '
  '이름으로 훑을 수 있게 되면 선수 명부가 된다.';

revoke all on function public.search_posts(text, int) from public;
grant execute on function public.search_posts(text, int) to anon, authenticated;
