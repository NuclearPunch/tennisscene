/**
 * supabase/migrations/*.sql 를 하나로 합쳐 supabase/schema.sql 을 만든다.
 * Supabase 대시보드 SQL Editor 에 붙여넣기용. CLI 링크 없이 스키마를 올릴 때 쓴다.
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const DIR = "supabase/migrations";
const OUT = "supabase/schema.sql";

const files = readdirSync(DIR).filter((f) => f.endsWith(".sql")).sort();

const header = `-- 테니스씬 전체 스키마
-- supabase/migrations/*.sql 를 순서대로 합친 것이다. 생성물이니 직접 고치지 마라.
-- 다시 만들려면: npm run schema
--
-- Supabase 대시보드 → SQL Editor 에 통째로 붙여넣고 실행한다.
-- 한 번만 돌린다. 두 번 돌리면 create type / create table 에서 깨진다.
`;

const body = files
  .map((f) => {
    const bar = "═".repeat(Math.max(0, 60 - f.length));
    return `\n\n-- ═══ ${f} ${bar}\n` + readFileSync(join(DIR, f), "utf-8").trimEnd();
  })
  .join("");

writeFileSync(OUT, header + body + "\n");
console.log(`${OUT} — ${files.length}개 파일`);
