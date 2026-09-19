-- 테니스씬 기반 스키마 · 1/8 — 열거형
--
-- 여기의 값은 src/lib/types.ts 의 유니온과 1:1 이다.
-- 한쪽만 바꾸면 계약이 깨진다. 값을 추가할 때는 양쪽을 같이 고친다.

-- 봇·브랜드·유저가 같은 accounts 테이블에 들어간다.
-- 공지 전용 테이블을 따로 두지 않는 이유: 봇 글에도 댓글·좋아요·인용이 달리고,
-- 그때 계정이 두 테이블로 쪼개져 있으면 posts.author_id 가 가리킬 곳이 없어진다.
create type public.account_kind as enum ('bot', 'brand', 'user');

-- 아바타 표시용. UI 가 소유하는 값이지만 계정 행에 붙어 다닌다.
create type public.avatar_tone as enum ('green', 'neutral', 'ball');
create type public.avatar_icon as enum ('weather', 'chart', 'play', 'calendar', 'box', 'ball');

-- posts 는 단일 테이블이고 type + payload 로 분기한다.
-- 타입별 테이블을 만들면 "시간순 단일 피드" 한 번에 7-way UNION 이 된다.
create type public.post_type as enum (
  'text',
  'ranking',
  'tournament',
  'video',
  'gear',
  'score',
  'weather'
);

create type public.report_status as enum ('open', 'reviewing', 'actioned', 'dismissed');

create type public.name_removal_status as enum ('received', 'verifying', 'approved', 'rejected', 'done');
