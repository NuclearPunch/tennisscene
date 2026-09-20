import postgres, { type Sql } from "postgres";

/**
 * 수집·게시 잡용 DB 연결.
 *
 * 배치 잡은 PostgREST 를 거치지 않고 Postgres 에 직접 붙는다.
 * supabase-js 는 요청 단위 앱 코드용이다 — 250행 upsert 나 여러 쿼리를 묶는
 * 트랜잭션에는 맞지 않는다. Supabase 도 서버 배치는 직접 연결을 권한다.
 *
 * 앱(브라우저·라우트 핸들러)은 이 파일을 쓰지 않는다. 거기는 공개 키 + RLS 다.
 */
export function jobDb(): Sql {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL 이 필요하다. .env.local 에 넣거나 --dry-run 으로 실행해라.\n" +
        "Supabase → Project Settings → Database → Connection string (Session pooler)",
    );
  }
  return postgres(url, {
    // 잡은 한 번 돌고 끝난다. 풀을 크게 잡을 이유가 없다.
    max: 4,
    idle_timeout: 20,
    connect_timeout: 30,
    // 풀러는 prepared statement 를 지원하지 않는다
    prepare: false,
  });
}
