import type { Sql } from "postgres";
import { buildResultPost } from "@/lib/publish/resultPost";
import {
  insertResultPost,
  loadPostedResultKeys,
  loadSuppressedPlayers,
} from "@/lib/repositories/posts";
import { loadStoryContext } from "./storyContext";
import { katoResults as R } from "@/lib/sources/katoResults";
import { katoTournaments as K, type TournamentStub } from "@/lib/sources/katoTournaments";
import type { JobReport } from "./types";

const ORG = "kato";
const BOT = "b_tour";

/**
 * 대회 결과 게시 — B-1.7
 *
 * **결과는 대회가 아니라 부서 단위로 확정된다.** 개나리부가 끝난 날 결과가 뜨고
 * 마스터스부는 사흘 뒤에 뜬다. 대회가 끝난 뒤 한 번만 도는 잡으로는 놓친다.
 * 그래서 진행 중·최근 종료 대회를 매일 다시 훑고, 이미 올린 부서는 건너뛴다.
 */
const TAIL_DAYS = 21;

/** 남의 서버다. 한 번에 몰아치지 않는다. */
const DELAY_MS = 350;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * 대회 날짜는 전부 KST 다. UTC 로 자르면 한국 저녁에 하루가 밀려서
 * 경계에 걸린 대회를 하루 늦게 본다. 앞뒤로 9시간 밀어서 읽는다.
 */
const KST_OFFSET_MS = 9 * 3600_000;
function isoDay(d: Date): string {
  return new Date(d.getTime() + KST_OFFSET_MS).toISOString().slice(0, 10);
}

/** 이미 시작했고, 끝난 지 TAIL_DAYS 를 안 넘긴 대회. */
export function candidates(all: TournamentStub[], now = new Date()): TournamentStub[] {
  const today = isoDay(now);
  const floor = isoDay(new Date(now.getTime() - TAIL_DAYS * 86400_000));
  return all
    .filter((t) => t.startDate <= today && t.endDate >= floor)
    .sort((a, b) => b.endDate.localeCompare(a.endDate));
}

export async function runResults(
  db: Sql,
  opts: { dryRun?: boolean } = {},
): Promise<JobReport> {
  const lines: string[] = [];
  const dry = opts.dryRun === true;

  const all = K.parseList(await K.fetchList());
  const targets = candidates(all);
  lines.push(
    `대회 ${all.length}건 · 결과를 확인할 대회 ${targets.length}건 (종료 후 ${TAIL_DAYS}일까지)`,
  );

  // dry-run 도 비공개 목록은 **읽는다.** 모른 채 돌리면 가려야 할 이름을 로그에 찍는다.
  const posted = dry ? new Set<string>() : await loadPostedResultKeys(db, ORG);
  const suppressed = await loadSuppressedPlayers(db, ORG);
  // 해석·포인트 한 줄의 재료. 한 번만 읽어 모든 포스트가 같이 쓴다.
  const ctx = await loadStoryContext(db, ORG);
  lines.push(
    `이미 올린 부서 ${posted.size}개 · 이름 비공개 ${suppressed.size}명 · ` +
      `이력 보유 선수 ${ctx.counts.history}명 · 랭킹 ${ctx.counts.ranks}명`,
  );

  let inserted = 0;
  let duplicate = 0;
  let pending = 0;
  let masked = 0;

  for (const t of targets) {
    const parts = R.parseParts(await R.fetchGame(t.sourceId), t.sourceId);
    await sleep(DELAY_MS);

    for (const part of parts) {
      if (posted.has(`${t.sourceId}/${part.partCode}`)) continue;

      const result = R.parseResult(
        await R.fetchResult(t.sourceId, part.partCode),
        t.sourceId,
        part.partCode,
        part.division,
      );
      await sleep(DELAY_MS);

      if (!result) {
        // 아직 안 끝났거나 결과 입력 전이다. 실패가 아니라서 조용히 넘어간다.
        pending++;
        continue;
      }

      const post = buildResultPost({
        result,
        tournamentName: t.name,
        endsOn: t.endDate,
        org: ORG,
        suppressed,
        history: ctx.history,
        ranks: ctx.ranks,
        rankAt: ctx.rankAt,
        grade: t.grade,
        reflected: ctx.reflected(t.endDate),
      });
      if (!post) {
        // 시상대에 이름 비공개 승인 선수가 있다. 우승을 가리면 남는 게 없어서 안 올린다.
        masked++;
        lines.push(`비공개 — ${t.name} ${part.division}`);
        continue;
      }

      if (dry) {
        lines.push(post.body);
        inserted++;
        continue;
      }

      const outcome = await insertResultPost(db, BOT, post.body, post.payload);
      if (outcome === "inserted") inserted++;
      else duplicate++;
      lines.push(
        `${outcome === "inserted" ? "게시" : "중복"} — ${t.name} ${result.division}`,
      );
    }
  }

  return {
    job: "results",
    summary:
      `대회 결과 ${dry ? "게시 예정" : "게시"} ${inserted}건 · 중복 ${duplicate}건 · ` +
      `결과 대기 ${pending}건 · 비공개로 제외 ${masked}건`,
    lines,
  };
}
