import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  /*
   * 앱(mobile/)이 이 API 를 부른다. 네이티브 앱은 CORS 를 안 보지만, 개발 중 같은 앱을
   * 브라우저로 띄우면(expo web) 다른 출처라 막힌다.
   *
   * 출처를 전부 열어도 괜찮은 이유: 인증이 쿠키가 아니라 Authorization 헤더의 토큰이다.
   * 다른 사이트가 이 주소를 불러도 사용자의 토큰을 가져올 방법이 없다.
   */
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET, POST, PUT, PATCH, DELETE, OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Authorization, Content-Type" },
          { key: "Access-Control-Max-Age", value: "86400" },
        ],
      },
    ];
  },
};

export default nextConfig;
