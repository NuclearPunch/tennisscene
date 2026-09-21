import type { MetadataRoute } from "next";

/**
 * 홈 화면에 설치되는 앱의 신분증.
 *
 * 크롬이 설치를 권하려면 이름·아이콘(192·512)·start_url·display:standalone 에
 * **fetch 를 듣는 서비스 워커**까지 있어야 한다. 워커는 public/sw.js 에 있다.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "테니스씬",
    short_name: "테니스씬",
    description: "동호인 테니스의 모든 것이 하나의 피드로",
    lang: "ko",
    start_url: "/",
    // 설치 뒤 주소창이 사라진다. 앱처럼 보이는 건 거의 이 한 줄이다.
    display: "standalone",
    orientation: "portrait",
    // 첫 화면이 뜨기 전 잠깐 깔리는 색. 라이트를 기준으로 둔다 — 시작 화면은 한 가지뿐이다.
    background_color: "#ffffff",
    theme_color: "#ffffff",
    categories: ["sports", "social"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // 안드로이드는 아이콘을 제 모양대로 자른다. 가장자리 20% 가 잘려도 되게 따로 만든다.
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    // 길게 눌렀을 때 나오는 바로가기.
    shortcuts: [
      { name: "새 글 쓰기", url: "/compose" },
      { name: "대회 결과", url: "/?tag=result" },
    ],
  };
}
