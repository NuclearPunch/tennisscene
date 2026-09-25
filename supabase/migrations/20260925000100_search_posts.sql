-- ─────────────────────────────────────────────────────────────
-- 글 검색 (F-4.1)
--
-- **선수 이름 인덱스를 만들지 않는다**(CLAUDE.md). 여기서 뒤지는 건 우리가 이미
-- 피드에 올린 글이지 선수 명부가 아니다. 그래서:
--   · ranking_snapshots 는 건드리지 않는다 — 부서별 250명을 이름으로 훑을 수 있게 되면
--     그게 바로 명부다
--   · payload 통째로(payload::text) 뒤지지 않는다 — 랭킹 포스트 payload 에는 10위까지의
--     이름이 들어 있어서, 그걸 열면 사실상 같은 일이 된다
--   · 본문과 대회명·영상 제목·부서만 본다. 우승자 이름은 본문에 이미 있어서
--     "김재원" 으로 찾으면 그 우승 글이 나온다. 스크롤해서 찾는 것과 같은 범위다.
--
-- 함수로 두는 이유: PostgREST 의 or() 필터에 사용자 입력을 문자열로 끼워 넣으면
-- 쉼표·괄호 하나로 질의가 깨진다. 파라미터로 받으면 그럴 일이 없다.
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
      coalesce(p.body, '')                          ilike n.pat escape '\'
      or coalesce(p.payload ->> 'tournamentName', '') ilike n.pat escape '\'
      or coalesce(p.payload ->> 'title', '')          ilike n.pat escape '\'
      or coalesce(p.payload ->> 'division', '')       ilike n.pat escape '\'
      or coalesce(p.payload ->> 'name', '')           ilike n.pat escape '\'
    )
  order by p.created_at desc
  limit least(greatest(lim, 1), 50);
$$;

comment on function public.search_posts(text, int) is
  '피드 글 검색. 본문·대회명·영상 제목·부서만 본다. 선수 명부를 만들지 않으려고 '
  'ranking_snapshots 와 payload 전체는 건드리지 않는다.';

revoke all on function public.search_posts(text, int) from public;
grant execute on function public.search_posts(text, int) to anon, authenticated;
