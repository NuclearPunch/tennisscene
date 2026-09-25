// 앱 아이콘을 웹과 같은 심벌(공 테두리 + S 솔기)로 그린다. 벡터에서 바로 뽑아서 1024px 도 선명하다.
//   node scripts/make-icons.mjs
// sharp 는 웹(루트)에 이미 있는 것을 빌려 쓴다.
import { createRequire } from "node:module";
const require = createRequire(new URL("../../package.json", import.meta.url));
const sharp = require("sharp");

const SEAM = "M102.43 13.29A32 32 0 0 1 50 50A32 32 0 0 0 -2.43 86.71";
const INK = "#101010"; // 앱 다크 바탕과 같다

/** 심벌 하나. scale 은 캔버스 대비 공 지름 비율 */
function svg({ size = 1024, bg = null, color = "#fff", scale = 0.62 }) {
  const s = scale; // 100 단위 심벌을 캔버스의 s 만큼 차지하게
  const off = (100 - 100 * s) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100">
  ${bg ? `<rect width="100" height="100" fill="${bg}"/>` : ""}
  <g transform="translate(${off} ${off}) scale(${s})">
    <clipPath id="b"><circle cx="50" cy="50" r="43.5"/></clipPath>
    <circle cx="50" cy="50" r="43.5" fill="none" stroke="${color}" stroke-width="13"/>
    <path d="${SEAM}" fill="none" stroke="${color}" stroke-width="13" clip-path="url(#b)"/>
  </g></svg>`;
}

const out = (name) => new URL(`../assets/images/${name}`, import.meta.url).pathname;
const png = (s, name) => sharp(Buffer.from(s)).png().toFile(out(name));

await Promise.all([
  // iOS: 투명 없이 꽉 채운다. 모서리는 iOS 가 깎는다. (웹 apple-icon 과 같은 비율 0.62)
  png(svg({ bg: INK }), "icon.png"),
  // 안드로이드 적응형: 가운데 안전 영역(지름의 약 2/3) 안에 심벌을 둔다
  png(svg({ scale: 0.42 }), "android-icon-foreground.png"),
  png(svg({ bg: INK, scale: 0 }), "android-icon-background.png"),
  png(svg({ scale: 0.42 }), "android-icon-monochrome.png"),
  // 스플래시: 라이트는 흰 바탕에 검정 심벌, 다크는 반대
  png(svg({ size: 512, color: "#000", scale: 0.9 }), "splash-icon.png"),
  png(svg({ size: 512, color: "#fff", scale: 0.9 }), "splash-icon-dark.png"),
  png(svg({ size: 48, bg: INK }), "favicon.png"),
]);
console.log("아이콘을 새로 그렸다");
