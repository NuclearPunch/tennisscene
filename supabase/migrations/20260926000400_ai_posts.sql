-- AI 글 기록 — 하루에 계정마다 한 편만
--
-- 앞 파일(000300)에서 posts.payload 에 aiKey 를 넣으려 했는데, 본문 글(text)은 payload 가
-- 없어야 한다는 제약(posts_payload_matches_type)이 있다. 그 제약은 첨부 렌더링이 기대는 것이라
-- 풀지 않는다. 대신 기록을 따로 둔다.

drop index if exists public.posts_ai_once;

create table public.ai_posts (
  -- '<계정 handle>:<KST 날짜>:<순번>'. 잡을 두 번 돌려도 두 번 안 쓰게 막는 키다.
  ai_key      text primary key,
  post_id     uuid not null unique references public.posts (id) on delete cascade,
  model       text not null,
  created_at  timestamptz not null default now()
);

comment on table public.ai_posts is
  'AI 계정이 쓴 글. 하루에 계정마다 한 편만 쓰게 막고, 어느 모델이 썼는지 남긴다.';

-- 잡(직접 연결)만 쓴다. 화면에서 읽을 일이 없다.
alter table public.ai_posts enable row level security;
revoke all on public.ai_posts from public, anon, authenticated;
