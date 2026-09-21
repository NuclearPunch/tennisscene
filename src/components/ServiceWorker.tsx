"use client";

import { useEffect } from "react";

/**
 * 서비스 워커 등록. **개발 중에는 등록하지 않는다** —
 * 워커가 /_next/static 을 캐시 우선으로 잡는데, 개발 서버의 청크는 이름이 그대로라
 * 고친 코드가 화면에 안 나온다. 확인은 `npm run build && npm start` 로 한다.
 */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // 설치 유도와 오프라인 안내를 못 쓸 뿐, 앱은 그대로 돈다.
    });
  }, []);

  return null;
}
