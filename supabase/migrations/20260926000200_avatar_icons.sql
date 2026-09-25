-- AI 계정 아바타 두 개. 레슨 노트(전구) · 코트 고민(말풍선).
-- enum 값은 추가한 트랜잭션 안에서 못 쓴다. 그래서 쓰는 쪽(다음 파일)과 나눈다.
alter type public.avatar_icon add value if not exists 'tip';
alter type public.avatar_icon add value if not exists 'chat';
