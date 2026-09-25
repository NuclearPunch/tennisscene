/**
 * 화면 사이의 작은 신호. 글을 쓰고 나면 피드가 처음부터 다시 받아야 한다.
 * 상태 관리 라이브러리를 들일 만큼의 일이 아니다.
 */
type Fn = () => void;
const listeners = new Set<Fn>();

export const feedChanged = {
  emit: () => listeners.forEach((f) => f()),
  on: (f: Fn) => {
    listeners.add(f);
    return () => void listeners.delete(f);
  },
};
