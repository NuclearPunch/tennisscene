/*
 * 테니스씬 서비스 워커.
 *
 * 여기서 하는 일은 둘뿐이다.
 *   1. 크롬이 "설치" 를 권하게 만든다 — fetch 를 듣는 워커가 있어야 조건이 찬다
 *   2. 인터넷이 끊겼을 때 흰 화면 대신 안내를 띄운다
 *
 * **피드를 캐시하지 않는다.** 랭킹과 대회 결과는 바뀌는 값이라, 캐시해서 보여주면
 * 지난주 순위를 이번 주인 척 보여주게 된다. 화면(HTML)은 언제나 네트워크 먼저다.
 * /_next/static 만 캐시한다 — 파일 이름에 해시가 박혀 있어 내용이 바뀌면 이름도 바뀐다.
 */
const VERSION = "v1";
const SHELL = `shell-${VERSION}`;
const STATIC = `static-${VERSION}`;
const OFFLINE = "/offline";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL).then((c) => c.addAll([OFFLINE])).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => !k.endsWith(VERSION)).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // API 는 절대 캐시하지 않는다. 글쓰기·피드·크론이 다 여기로 다닌다.
  if (url.pathname.startsWith("/api/")) return;

  // 화면 이동: 네트워크 먼저, 끊겼으면 안내 페이지.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match(OFFLINE).then((r) => r || Response.error())),
    );
    return;
  }

  // 해시 박힌 정적 파일: 캐시 먼저. 같은 이름이면 내용도 같다.
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ||
          fetch(request).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(STATIC).then((c) => c.put(request, copy));
            }
            return res;
          }),
      ),
    );
  }
});
