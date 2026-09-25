// 웹 로고(../src/components/Logo.tsx)의 도형 데이터를 앱으로 옮긴다.
// 로고는 글꼴에서 뽑은 생성물이라 손으로 옮기지 않는다. 웹 로고가 바뀌면 이걸 다시 돌린다:
//   node scripts/sync-logo.mjs
import { readFileSync, writeFileSync } from "node:fs";

const src = readFileSync(new URL("../../src/components/Logo.tsx", import.meta.url), "utf-8");
const seam = src.match(/const SEAM = "([^"]+)"/)?.[1];
const glyphs = src.match(/const GLYPHS: \[number, string\]\[\] = (\[\[[\s\S]*?\]\]);/)?.[1];
if (!seam || !glyphs) throw new Error("Logo.tsx 모양이 바뀌었다 — 이 스크립트의 정규식을 고쳐라");

writeFileSync(
  new URL("../src/components/brand/logoPaths.ts", import.meta.url),
  `// 생성물이다 — scripts/sync-logo.mjs 가 웹 Logo.tsx 에서 뽑았다. 손으로 고치지 마라.\n` +
    `export const SEAM = ${JSON.stringify(seam)};\n` +
    `export const GLYPHS: [number, string][] = ${glyphs};\n`,
);
console.log("logoPaths.ts 를 새로 썼다");
