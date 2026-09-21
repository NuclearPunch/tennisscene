/**
 * 잡 스크립트용 `.env.local` 로더.
 *
 * Next.js 는 `.env.local` 을 알아서 읽지만 `tsx scripts/...` 는 안 읽는다.
 * node 의 `--env-file` 은 파일이 없으면 20.10 에서 그냥 죽어서 CI·Vercel 에서 못 쓴다
 * (`--env-file-if-exists` 는 20.12+). 그래서 여기서 직접 읽는다.
 *
 * **이미 들어 있는 값은 덮지 않는다.** 배포 환경에서 주입한 값이 우선이다.
 * 잡의 맨 윗줄에서 import 한다 — DB 를 여는 모듈보다 먼저 돌아야 한다.
 */
import { existsSync, readFileSync } from "node:fs";

const FILE = ".env.local";

if (existsSync(FILE)) {
  for (const line of readFileSync(FILE, "utf-8").split("\n")) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue; // 빈 줄·주석
    const key = m[1];
    if (process.env[key] !== undefined) continue;
    // 따옴표로 감싼 값만 벗긴다. 값 안의 따옴표는 건드리지 않는다.
    process.env[key] = m[2].trim().replace(/^(['"])([\s\S]*)\1$/, "$2");
  }
}
