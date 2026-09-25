-- ─────────────────────────────────────────────────────────────
-- videos.posted_at · videos.post_id 를 없앤다.
--
-- 5/8 에서 "게시 잡이 posted_at 을 보고 안 올라간 것만 고른다" 로 설계했지만
-- 그렇게 만들지 않았다. 게시 여부는 posts 쪽이 안다:
--   · 중복 방지는 posts_video_once_idx (payload ->> 'providerVideoId')
--   · 잡은 loadPostedVideoIds 로 posts 를 읽는다
--   · 포스트 → 영상 연결은 payload ->> 'videoId' (= videos.id)
--
-- 두 컬럼은 아무도 안 썼고, 영상 포스트가 45건 있는데도 전부 null 이었다.
-- videos 를 들여다보면 "아무것도 안 올라갔다" 로 읽혀서 없는 것보다 나빴다.
-- 게시 여부의 출처를 둘로 두지 않는다 — 채워도 결국 posts 와 어긋난다.
-- ─────────────────────────────────────────────────────────────
drop index if exists public.videos_unposted_idx;

alter table public.videos
  drop column posted_at,
  drop column post_id;

comment on table public.videos is
  '수집된 경기 영상. 게시 여부는 여기 없다 — '
  'posts 에서 type = ''video'' 이고 payload ->> ''providerVideoId'' 가 같은 행을 본다.';
