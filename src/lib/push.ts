import type { Sql } from "postgres";

/**
 * 푸시 알림 보내기 — Expo 푸시 서비스를 거친다(애플·구글로 각각 보내지 않는다).
 *
 * 한 번에 100건까지 보낼 수 있다(Expo 제한). 보내면 "표(ticket)" 를 받는데,
 * 표에 바로 `DeviceNotRegistered` 가 오면 그 기기는 앱을 지웠거나 알림을 껐다 — 토큰을 지운다.
 * 표가 ok 여도 실제 전달 결과(영수증)는 나중에 나온다. 그건 매일 크론이 확인한다(checkReceipts).
 *
 * EXPO_ACCESS_TOKEN 이 있으면 실어 보낸다. Expo 대시보드에서 "강화된 푸시 보안" 을 켜면
 * 이 토큰 없이는 누구도 우리 앱 사용자에게 알림을 보낼 수 없다.
 */

const SEND = "https://exp.host/--/api/v2/push/send";
const RECEIPTS = "https://exp.host/--/api/v2/push/getReceipts";
const CHUNK = 100;

export type PushMessage = {
  to: string;
  title: string;
  body: string;
  /** 누르면 열 화면. 앱이 router.push 로 연다. */
  data: { url: string };
};

type Ticket = { status: "ok"; id: string } | { status: "error"; message?: string; details?: { error?: string } };

function headers(): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json", Accept: "application/json" };
  const token = process.env.EXPO_ACCESS_TOKEN;
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

export async function sendPush(db: Sql, messages: PushMessage[]): Promise<{ sent: number; dropped: number; failed: number }> {
  let sent = 0;
  let dropped = 0;
  let failed = 0;
  for (let i = 0; i < messages.length; i += CHUNK) {
    const chunk = messages.slice(i, i + CHUNK).map((m) => ({ ...m, sound: "default" as const }));
    let tickets: Ticket[] = [];
    try {
      const res = await fetch(SEND, { method: "POST", headers: headers(), body: JSON.stringify(chunk) });
      const json = (await res.json()) as { data?: Ticket[]; errors?: unknown };
      if (!res.ok || !json.data) throw new Error(`Expo push ${res.status}: ${JSON.stringify(json.errors ?? json).slice(0, 200)}`);
      tickets = json.data;
    } catch (err) {
      console.error("[push] 보내지 못했다", err instanceof Error ? err.message : err);
      failed += chunk.length;
      continue;
    }
    const gone: string[] = [];
    const ok: [string, string][] = [];
    tickets.forEach((t, k) => {
      if (t.status === "ok") ok.push([t.id, chunk[k].to]);
      else if (t.details?.error === "DeviceNotRegistered") gone.push(chunk[k].to);
      else failed++;
    });
    if (gone.length) await db`delete from push_tokens where token in ${db(gone)}`;
    if (ok.length) await db`insert into push_tickets (id, token) values ${db(ok)} on conflict do nothing`;
    sent += ok.length;
    dropped += gone.length;
  }
  return { sent, dropped, failed };
}

/** 영수증 확인. 기기가 없어졌다고 나오면 토큰을 지운다. 영수증은 24시간 뒤 사라지므로 그 전 것만 본다. */
export async function checkReceipts(db: Sql): Promise<{ checked: number; dropped: number }> {
  const tickets = await db<{ id: string; token: string }[]>`
    select id, token from push_tickets where created_at > now() - interval '24 hours' limit 1000`;
  let dropped = 0;
  if (tickets.length) {
    try {
      const res = await fetch(RECEIPTS, { method: "POST", headers: headers(), body: JSON.stringify({ ids: tickets.map((t) => t.id) }) });
      const json = (await res.json()) as { data?: Record<string, { status: string; details?: { error?: string } }> };
      const gone = tickets.filter((t) => json.data?.[t.id]?.details?.error === "DeviceNotRegistered").map((t) => t.token);
      if (gone.length) await db`delete from push_tokens where token in ${db(gone)}`;
      dropped = gone.length;
    } catch (err) {
      console.error("[push] 영수증을 못 받았다", err instanceof Error ? err.message : err);
    }
  }
  // 확인했거나 24시간이 지나 확인할 수 없는 표는 버린다.
  await db`delete from push_tickets where created_at < now() - interval '15 minutes'`;
  return { checked: tickets.length, dropped };
}

/**
 * 내 글에 댓글이 달렸다고 알린다.
 *
 * 알리지 않는 경우: 내가 단 댓글, 봇 글(주인이 사람이 아니다), 지워진 글,
 * 글쓴이가 댓글 단 사람을 차단했을 때(차단한 사람 소식을 알림으로 받으면 차단한 의미가 없다).
 * 댓글 단 사람이 익명이면 이름 대신 "익명" 이다.
 */
export async function notifyReply(
  db: Sql,
  input: { parentId: string; commenterId: string; anonymous: boolean; body: string },
): Promise<void> {
  const rows = await db<{ token: string; commenter: string }[]>`
    select t.token, c.name as commenter
    from posts p
    join accounts a on a.id = p.author_id
    join accounts c on c.id = ${input.commenterId}
    join push_tokens t on t.account_id = p.author_id
    where p.id = ${input.parentId}
      and p.deleted_at is null
      and a.kind = 'user'
      and p.author_id <> ${input.commenterId}
      and not exists (
        select 1 from blocks b where b.blocker_id = p.author_id and b.blocked_id = ${input.commenterId}
      )`;
  if (rows.length === 0) return;
  const who = input.anonymous ? "익명" : rows[0].commenter;
  const text = input.body.replace(/\s+/g, " ").slice(0, 80);
  await sendPush(
    db,
    rows.map((r) => ({ to: r.token, title: "내 글에 댓글", body: `${who}: ${text}`, data: { url: `/p/${input.parentId}` } })),
  );
}

/** 월요일 주간 랭킹 발표. 전체에 보낸다. 랭킹 글은 하루에 걸쳐 차례로 올라가서 문구도 그렇게 쓴다. */
export async function broadcastRanking(db: Sql): Promise<{ sent: number }> {
  const rows = await db<{ token: string }[]>`select token from push_tokens`;
  const r = await sendPush(
    db,
    rows.map((x) => ({
      to: x.token,
      title: "이번 주 카토 랭킹 발표",
      body: "부서별 1위가 오늘 하루 차례로 올라옵니다",
      data: { url: "/?tag=ranking" },
    })),
  );
  return { sent: r.sent };
}
