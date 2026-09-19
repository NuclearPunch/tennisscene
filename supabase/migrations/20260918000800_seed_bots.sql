-- 테니스씬 기반 스키마 · 8/8 — 봇 계정 시드
--
-- 여섯 개의 자동 발행 축. src/lib/accounts.ts 의 BOTS 와 id·handle·name·icon·tone 이
-- 문자 그대로 일치해야 한다. 한쪽만 고치면 게시 잡이 없는 계정을 찾는다.
--
-- 시드 데이터가 아니라 스키마의 일부로 본다 — 이 계정이 없으면 수집 파이프라인이 돌지 않는다.
-- 그래서 seed.sql 이 아니라 마이그레이션에 둔다. 재실행해도 안전하다.

insert into public.accounts (id, kind, handle, name, icon, tone) values
  ('b_today', 'bot', 'today', '오늘의 코트', 'weather',  'green'),
  ('b_rank',  'bot', 'rank',  '주간 랭킹',   'chart',    'green'),
  ('b_match', 'bot', 'match', '동호인 경기', 'play',     'green'),
  ('b_tour',  'bot', 'tour',  '대회 알림',   'calendar', 'green'),
  ('b_gear',  'bot', 'gear',  '장비',        'box',      'ball'),
  ('b_pro',   'bot', 'pro',   '프로 테니스', 'ball',     'green')
on conflict (id) do update set
  kind   = excluded.kind,
  handle = excluded.handle,
  name   = excluded.name,
  icon   = excluded.icon,
  tone   = excluded.tone,
  deleted_at = null;
