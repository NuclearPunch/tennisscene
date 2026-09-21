import type { Metadata, Viewport } from "next";
import { ServiceWorker } from "@/components/ServiceWorker";
import "./globals.css";

export const metadata: Metadata = {
  title: "테니스씬",
  description: "동호인 테니스의 모든 것이 하나의 피드로",
  applicationName: "테니스씬",
  /*
   * 홈 화면에 설치됐을 때. 아이콘 밑 이름은 짧아야 안 잘린다.
   *
   * Next 는 capable:true 를 **표준 이름(mobile-web-app-capable)으로만** 내보낸다.
   * 옛 이름(apple-mobile-web-app-capable)을 직접 달아도 같은 이름으로 바꿔 지워버린다.
   * 사파리가 표준 이름을 읽기 시작한 건 iOS 17.4(2024-03) 부터라,
   * 그 아래 기기는 홈 화면에서 열어도 주소창이 남는다. 읽고 쓰는 데는 지장이 없다.
   */
  appleWebApp: { capable: true, title: "테니스씬", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  // 시스템 설정을 따라간다. 상태바도 같이 바뀌어야 한다.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#101010" },
  ],
  colorScheme: "light dark",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  // 노치까지 화면을 쓴다. 가려지면 안 되는 자리는 env(safe-area-inset-*) 로 피한다.
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className="h-full">
      <head>
        {/* 애플 기기에서는 안 쓰인다(시스템 서체가 먼저다). 안드로이드·윈도우용 대체다. */}
        <link
          rel="stylesheet"
          crossOrigin="anonymous"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
      </head>
      <body className="min-h-full">
        {children}
        <ServiceWorker />
      </body>
    </html>
  );
}
