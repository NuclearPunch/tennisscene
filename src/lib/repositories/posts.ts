import type { Sql } from "postgres";
import type {
  Place,
  PlayerRank,
  PodiumAppearance,
} from "@/lib/publish/resultStory";
import type {
  RankingPayload,
  ResultPayload,
  TournamentPayload,
  VideoPayload,
} from "@/lib/types";

// postgres.js 의 json 헬퍼는 구조적 타입을 받는다. payload 는 평범한 객체라 그대로 넘어간다.

/** 랭킹 포스트를 쓴다. 이미 같은 단체·부서·주차가 있으면 조용히 건너뛴다. */
export async function insertRankingPost(
  db: Sql,
  authorId: string,
  body: string,
  payload: RankingPayload,
): Promise<"inserted" | "duplicate"> {
  try {
    await db`
      insert into posts (author_id, type, body, payload)
      values (${authorId}, 'ranking', ${body}, ${db.json(payload)})`;
    return "inserted";
  } catch (err) {
    // posts_ranking_once_idx 위반. 게시 잡을 두 번 돌린 것뿐이라 실패가 아니다.
    if ((err as { code?: string }).code === "23505") return "duplicate";
    throw err;
  }
}

/** 이름 비공개가 승인된 선수. 발행 전에 걸러내려고 읽는다. */
export async function loadSuppressedPlayers(
  db: Sql,
  org: string,
): Promise<Set<string>> {
  const rows = await db<{ player_key: string }[]>`
    select player_key from suppressed_players where org = ${org}`;
  return new Set(rows.map((r) => r.player_key));
}

/** 대회 포스트. 이미 올린 대회면 조용히 건너뛴다. */
export async function insertTournamentPost(
  db: Sql,
  authorId: string,
  body: string,
  payload: TournamentPayload,
): Promise<"inserted" | "duplicate"> {
  try {
    await db`
      insert into posts (author_id, type, body, payload)
      values (${authorId}, 'tournament', ${body}, ${db.json(payload)})`;
    return "inserted";
  } catch (err) {
    // posts_tournament_once_idx 위반. 이미 올린 대회다.
    if ((err as { code?: string }).code === "23505") return "duplicate";
    throw err;
  }
}

/** 대회 결과 포스트. 같은 대회·부서를 이미 올렸으면 조용히 건너뛴다. */
export async function insertResultPost(
  db: Sql,
  authorId: string,
  body: string,
  payload: ResultPayload,
): Promise<"inserted" | "duplicate"> {
  try {
    await db`
      insert into posts (author_id, type, body, payload)
      values (${authorId}, 'result', ${body}, ${db.json(payload)})`;
    return "inserted";
  } catch (err) {
    // posts_result_once_idx 위반. 결과는 부서별로 하루 이틀 시차를 두고 뜨기 때문에
    // 같은 대회를 며칠 다시 훑는다. 중복은 정상 동작이다.
    if ((err as { code?: string }).code === "23505") return "duplicate";
    throw err;
  }
}

/**
 * 이미 올린 대회 결과의 `{sourceId}/{partCode}` 집합.
 *
 * 중복은 posts_result_once_idx 가 막지만, 그건 insert 까지 간 뒤의 이야기다.
 * 이걸 먼저 읽으면 이미 올린 부서에 대해 `/resultPart` 를 다시 두드리지 않는다 —
 * 대회 하나가 몇 주씩 열려 있어서 안 그러면 같은 요청을 매일 반복한다.
 */
export async function loadPostedResultKeys(
  db: Sql,
  org: string,
): Promise<Set<string>> {
  const rows = await db<{ key: string }[]>`
    select (payload ->> 'sourceId') || '/' || (payload ->> 'partCode') as key
    from posts
    where type = 'result'
      and deleted_at is null
      and payload ->> 'org' = ${org}`;
  return new Set(rows.map((r) => r.key));
}

/**
 * 이미 올린 결과 포스트에서 **선수별 시상대 이력**을 뽑는다.
 *
 * 따로 테이블을 두지 않는다 — 시상대는 이미 `posts.payload` 안에 다 있고,
 * 같은 사실을 두 곳에 두면 어긋난다. `posts_payload_gin` 이 이 조회를 받쳐준다.
 */
export async function loadPodiumHistory(
  db: Sql,
  org: string,
): Promise<Map<string, PodiumAppearance[]>> {
  const rows = await db<
    {
      player_key: string;
      source_id: string;
      tournament_name: string;
      division: string;
      ends_on: string | null;
      place: Place;
    }[]
  >`
    select
      x.player ->> 'playerKey'   as player_key,
      p.payload ->> 'sourceId'   as source_id,
      p.payload ->> 'tournamentName' as tournament_name,
      p.payload ->> 'division'   as division,
      p.payload ->> 'endsOn'     as ends_on,
      x.place
    from posts p
    cross join lateral (
      select '우승'::text as place,
             jsonb_array_elements(p.payload -> 'champion' -> 'players') as player
      union all
      select '준우승',
             jsonb_array_elements(coalesce(p.payload -> 'runnerUp' -> 'players', '[]'::jsonb))
      union all
      select '공동 3위', jsonb_array_elements(coalesce(t.team -> 'players', '[]'::jsonb))
      from jsonb_array_elements(coalesce(p.payload -> 'semifinalists', '[]'::jsonb)) as t(team)
    ) x
    where p.type = 'result'
      and p.deleted_at is null
      and p.payload ->> 'org' = ${org}
      and x.player ->> 'playerKey' is not null
    order by p.payload ->> 'endsOn'`;

  const out = new Map<string, PodiumAppearance[]>();
  for (const r of rows) {
    const list = out.get(r.player_key) ?? [];
    list.push({
      sourceId: r.source_id,
      tournamentName: r.tournament_name,
      division: r.division,
      endsOn: r.ends_on,
      place: r.place,
    });
    out.set(r.player_key, list);
  }
  return out;
}

/**
 * 해당 주차 랭킹에 있는 선수들의 부서·순위.
 * **비공개 승인 선수는 뺀다** — 이름을 가린 선수의 순위를 말하면 가린 의미가 없다.
 */
export async function loadPlayerRanks(
  db: Sql,
  org: string,
  week: string,
): Promise<Map<string, PlayerRank>> {
  const rows = await db<
    { player_key: string; division: string; rank: number; points: string | null }[]
  >`
    select r.player_key, r.division, r.rank, r.points
    from ranking_snapshots r
    where r.org = ${org}
      and r.week = ${week}
      and not exists (
        select 1 from suppressed_players s
        where s.org = r.org and s.player_key = r.player_key
      )
    order by r.rank desc`;

  // 한 선수가 여러 부서 랭킹에 있을 수 있다. rank 내림차순으로 넣어서 가장 높은 순위가 남는다.
  const out = new Map<string, PlayerRank>();
  for (const r of rows) {
    out.set(r.player_key, {
      division: r.division,
      rank: r.rank,
      // numeric 은 postgres.js 가 문자열로 준다. 정밀도를 잃지 않으려는 기본 동작이다.
      points: r.points === null ? null : Number(r.points),
    });
  }
  return out;
}

/**
 * 부서별 점수 목록. "이 점수면 몇 위인가"를 답하는 데 쓴다.
 * 순위표를 통째로 들고 있어도 부서당 50명이라 가볍다.
 */
export async function loadDivisionPoints(
  db: Sql,
  org: string,
  week: string,
): Promise<Map<string, number[]>> {
  const rows = await db<{ division: string; points: string }[]>`
    select division, points
    from ranking_snapshots
    where org = ${org} and week = ${week} and points is not null
    order by division, points desc`;

  const out = new Map<string, number[]>();
  for (const r of rows) {
    const list = out.get(r.division) ?? [];
    list.push(Number(r.points));
    out.set(r.division, list);
  }
  return out;
}

/** 영상 포스트. 같은 영상을 이미 올렸으면 조용히 건너뛴다. */
export async function insertVideoPost(
  db: Sql,
  authorId: string,
  body: string,
  payload: VideoPayload,
): Promise<"inserted" | "duplicate"> {
  try {
    await db`
      insert into posts (author_id, type, body, payload)
      values (${authorId}, 'video', ${body}, ${db.json(payload)})`;
    return "inserted";
  } catch (err) {
    // posts_video_once_idx 위반. 매일 같은 업로드 목록을 훑으므로 정상 동작이다.
    if ((err as { code?: string }).code === "23505") return "duplicate";
    throw err;
  }
}

/**
 * 수집한 영상을 `videos` 에 넣고 id 를 돌려준다.
 * 이미 있으면 메타를 갱신한다 — **유튜브 약관이 30일 안에 다시 확인하라고 한다.**
 */
export async function upsertVideo(
  db: Sql,
  v: {
    providerVideoId: string;
    title: string;
    channelTitle: string;
    durationSeconds: number | null;
    thumbnailUrl: string | null;
    publishedAt: string;
    tournamentName: string | null;
    division: string | null;
    round: string | null;
  },
): Promise<string> {
  const [row] = await db<{ id: string }[]>`
    insert into videos (
      provider, provider_video_id, channel_title, title, duration_seconds,
      thumbnail_url, published_at, tournament_name, division, round
    ) values (
      'youtube', ${v.providerVideoId}, ${v.channelTitle}, ${v.title}, ${v.durationSeconds},
      ${v.thumbnailUrl}, ${v.publishedAt}, ${v.tournamentName}, ${v.division}, ${v.round}
    )
    on conflict (provider, provider_video_id) do update set
      title = excluded.title,
      channel_title = excluded.channel_title,
      duration_seconds = excluded.duration_seconds,
      thumbnail_url = excluded.thumbnail_url,
      tournament_name = excluded.tournament_name,
      division = excluded.division,
      round = excluded.round,
      refreshed_at = now()
    returning id`;
  return row.id;
}

/**
 * 이미 알고 있고 **아직 갱신할 때가 안 된** 영상들.
 *
 * 유튜브 약관은 저장한 메타데이터를 30일 안에 다시 확인하라고 한다. 그래서 전부
 * 건너뛰면 안 되고, `refreshed_at` 이 오래된 것만 다시 쓴다. 20일로 잡아 여유를 둔다.
 *
 * 이게 없으면 매일 영상 120건을 전부 다시 써서 DB 왕복만 수십 초가 된다.
 */
export async function loadFreshVideoIds(
  db: Sql,
  provider: string,
  maxAgeDays = 20,
): Promise<Set<string>> {
  const rows = await db<{ provider_video_id: string }[]>`
    select provider_video_id
    from videos
    where provider = ${provider}
      and refreshed_at > now() - (${maxAgeDays} || ' days')::interval`;
  return new Set(rows.map((r) => r.provider_video_id));
}

/** 이미 포스트로 올린 영상. 중복 insert 를 시도조차 안 하게 한다. */
export async function loadPostedVideoIds(
  db: Sql,
  provider: string,
): Promise<Set<string>> {
  const rows = await db<{ id: string }[]>`
    select payload ->> 'providerVideoId' as id
    from posts
    where type = 'video'
      and deleted_at is null
      and payload ->> 'provider' = ${provider}`;
  return new Set(rows.map((r) => r.id));
}
