-- 봇 글을 하루에 나눠 올린다 · AI 계정
--
-- 아침 9시 수집이 1분 안에 글 수십 개를 올려서, 시간순 피드에 같은 종류가 줄줄이 붙었다
-- (최근 60개 중 58개가 영상, 같은 종류 최대 34개 연속).
--
-- **정렬은 그대로 시간순이다**(CLAUDE.md 규칙 5). 순서를 섞는 대신 올리는 시각을 나눈다 —
-- 잡이 끝나면 새 봇 글의 created_at 을 그날 밤 10시까지 종류를 번갈아 흩어 놓고(src/lib/jobs/schedule.ts),
-- 이 뷰는 그 시각이 된 글만 보여준다. 피드·검색·상세가 모두 이 뷰를 읽으므로 한 곳만 고치면 된다.
-- 관리자 화면(admin_recent_posts)은 뷰를 거치지 않아서 예약된 글이 보인다 — 거기서 뺄 수 있다.

create or replace view public.posts_public
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
  -- 예약된 글은 그 시각이 되어야 보인다. 봇 글을 하루에 걸쳐 나눠 올리는 장치다.
  and p.created_at <= now()
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
  '피드·댓글 읽기 경로. 익명 글의 작성자와 탈퇴 계정을 가리고, 삭제·차단·아직 예약 시각이 안 된 글을 걸러낸다. '
  '차단은 익명 글에 적용하지 않는다(역추적 방지). 비회원(anon)도 읽을 수 있다.';


-- ─────────────────────────────────────────────────────────────
-- AI 계정
--
-- 봇 배지가 달린다(kind = bot). **사람인 척하지 않는다** — 가짜 경험담을 쓰면 실제 사용자를
-- 속이는 것이다. 블라인드 같은 속내 이야기는 AI 가 질문을 던지고 사람이 (익명으로) 답하게 한다.
-- 오늘의 코트(b_today)·장비(b_gear)는 이미 있는 계정을 쓴다.
-- ─────────────────────────────────────────────────────────────
insert into public.accounts (id, kind, handle, name, bio, icon, tone) values
  ('b_court', 'bot', 'court', '레슨 노트', 'AI 가 정리하는 기술·전술 노트. 틀린 데가 있으면 댓글로 알려주세요.', 'tip', 'green'),
  ('b_talk',  'bot', 'talk',  '코트 고민', 'AI 가 동호인들이 자주 겪는 고민을 질문으로 올립니다. 답은 여러분 몫이에요.', 'chat', 'neutral')
on conflict (id) do update set
  kind = excluded.kind, handle = excluded.handle, name = excluded.name,
  bio = excluded.bio, icon = excluded.icon, tone = excluded.tone, deleted_at = null;

update public.accounts set bio = 'AI 가 이번 주 코트 소식에 한마디 얹고 질문을 던집니다.'
where id = 'b_today' and bio is null;
update public.accounts set bio = 'AI 가 쓰는 장비 이야기. 추천보다는 질문이 많습니다.'
where id = 'b_gear' and bio is null;

-- AI 글은 하루에 계정마다 정해진 수만 쓴다. 잡을 두 번 돌려도 두 번 안 올라가게 막는다.
-- aiKey = '<계정>:<KST 날짜>:<순번>'
-- ※ 본문 글은 payload 를 못 가져서(posts_payload_matches_type) 이 인덱스는 쓸 수 없었다.
--   다음 파일(000400)이 걷어내고 ai_posts 테이블로 옮긴다.
create unique index if not exists posts_ai_once
  on public.posts ((payload ->> 'aiKey'))
  where payload ? 'aiKey';
