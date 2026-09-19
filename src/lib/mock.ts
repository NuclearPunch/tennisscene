import { BOTS, user } from "./accounts";
import type { Post } from "./types";

/**
 * 임시 시드 데이터. 수집 파이프라인이 붙기 전까지 피드 모양을 잡는 용도다.
 *
 * **동호인 선수는 가상 인물을 쓴다.** 원본 랭킹의 실명을 앱에 재게시하는 건
 * 별도의 초상권·개인정보 판단이 필요하다.
 * 프로 경기 결과(권순우 등)는 널리 공개된 스포츠 기록이라 성격이 다르므로 실명을 쓴다.
 */
export const FEED: Post[] = [
  {
    id: "p1",
    author: BOTS.today,
    timeLabel: "06:00",
    body: "서울 오전은 맑고 오후 3시부터 비. 야외 치실 분은 점심 전에 끝내세요.",
    attachment: {
      type: "weather",
      region: "서울",
      temp: 24,
      rainChance: 70,
      wind: "2m/s",
    },
    stats: { replies: 9, reposts: 2, likes: 34 },
  },
  {
    id: "p2",
    author: BOTS.rank,
    timeLabel: "월 09:00",
    body: "9월 2주차 수원 오픈부 1위는 강민호 선수. 3주 연속입니다.",
    attachment: {
      type: "ranking",
      org: "카토",
      division: "오픈부",
      region: "수원",
      week: "2026 W37",
      leader: { rank: 1, name: "강민호", club: "수원레이크", delta: 0, points: 2495 },
      story: "3주 연속 1위",
      runnersUp: [
        { rank: 2, name: "서준영", club: "분당새벽", delta: 2, points: 1609 },
        { rank: 3, name: "임태경", club: "대전한밭", delta: -1, points: 1470 },
        { rank: 4, name: "윤성재", club: "일산호수", delta: null, points: 1388 },
      ],
    },
    stats: { replies: 31, reposts: 8, likes: 142 },
  },
  {
    id: "p3",
    author: user("박지훈", "jihoon_t"),
    timeLabel: "2시간",
    body: "강민호 선수 또 1위네 ㅋㅋ 작년에 같은 조에서 만났는데 서브가 진짜 안 보임",
    quote: {
      authorName: "주간 랭킹",
      authorHandle: "rank",
      authorKind: "bot",
      icon: "chart",
      summary: "2026 W37 수원 오픈부 1위 — 강민호 (수원레이크), 3주 연속",
    },
    stats: { replies: 12, reposts: 1, likes: 47 },
    liked: true,
  },
  {
    id: "p4",
    author: BOTS.match,
    timeLabel: "5시간",
    body: "울진금강송배 오픈부 결승. 마지막 타이브레이크가 볼만합니다.",
    attachment: {
      type: "video",
      title: "2026 울진금강송배 오픈부 결승",
      channel: "KATO Tennis",
      duration: "12:04",
      source: "YouTube",
    },
    stats: { replies: 24, reposts: 9, likes: 118 },
  },
  {
    id: "p5",
    author: BOTS.gear,
    timeLabel: "어제",
    body: "요넥스 브이코어 100 최저가 갱신. 지난달보다 4만원 내렸습니다.",
    attachment: {
      type: "gear",
      product: "요넥스 브이코어 100",
      spec: "300g · 그립 2",
      price: 268000,
      wasPrice: 308000,
    },
    stats: { replies: 17, reposts: 6, likes: 52 },
  },
  {
    id: "p6",
    author: BOTS.tour,
    timeLabel: "목 08:00",
    body: "이번 주 접수 마감 대회",
    attachment: {
      type: "tournament",
      name: "제27회 포항시장배 전국동호인테니스대회",
      venue: "포항실내테니스장",
      dateLabel: "09.24 (수) — 09.27 (토)",
      deadlineLabel: "09.21 18:00",
      daysLeft: 3,
      divisions: ["오픈부", "신인부", "개나리부", "국화부"],
    },
    stats: { replies: 17, reposts: 6, likes: 52 },
  },
  {
    id: "p7",
    author: BOTS.pro,
    timeLabel: "어제",
    body: "권순우, 데이비스컵 단식 1승. 풀세트 접전 끝에 역전했습니다.",
    attachment: {
      type: "score",
      event: "DAVIS CUP · 조별예선",
      home: { name: "권순우", sets: [6, 3, 7], won: true },
      away: { name: "상대선수", sets: [4, 6, 5], won: false },
    },
    stats: { replies: 41, reposts: 7, likes: 186 },
  },
  {
    id: "p8",
    author: user("이민우", "minwoo"),
    timeLabel: "6시간",
    body: "서브 토스가 자꾸 앞으로 떨어지는데 그립 문제일까요 왼팔 각도 문제일까요. 영상 찍어보니까 확실히 릴리즈가 빠른 것 같기도 하고.",
    stats: { replies: 8, reposts: 0, likes: 21 },
  },
];
