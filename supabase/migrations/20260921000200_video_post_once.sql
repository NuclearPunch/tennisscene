-- ─────────────────────────────────────────────────────────────
-- 영상 하나당 포스트 하나.
--
-- 수집 잡은 채널의 최근 업로드 20건을 매일 다시 훑는다. 막아두지 않으면
-- 같은 영상이 매일 피드에 다시 올라온다.
-- ─────────────────────────────────────────────────────────────
create unique index posts_video_once_idx
  on public.posts ((payload ->> 'provider'), (payload ->> 'providerVideoId'))
  where type = 'video' and deleted_at is null;

comment on index public.posts_video_once_idx is
  '영상당 포스트 1개. 매일 같은 업로드 목록을 훑어도 한 번만 올라간다.';
