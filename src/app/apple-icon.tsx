import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** 홈 화면 아이콘. 검정 바탕에 흰 선 심벌 — 쓰레드와 같은 문법이다. */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#101010",
        }}
      >
        <svg width="112" height="112" viewBox="0 0 100 100">
          <clipPath id="b">
            <circle cx="50" cy="50" r="43.5" />
          </clipPath>
          <circle cx="50" cy="50" r="43.5" fill="none" stroke="#fff" strokeWidth="13" />
          <path
            d="M102.43 13.29A32 32 0 0 1 50 50A32 32 0 0 0 -2.43 86.71"
            fill="none"
            stroke="#fff"
            strokeWidth="13"
            clipPath="url(#b)"
          />
        </svg>
      </div>
    ),
    size,
  );
}
