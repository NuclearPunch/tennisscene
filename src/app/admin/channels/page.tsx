"use client";

import { useCallback, useEffect, useState } from "react";
import { adminFetch } from "@/lib/adminFetch";
import type { PreviewVideo } from "@/lib/jobs/youtube";
import type { ResolvedChannel } from "@/lib/sources/youtube";

/**
 * 유튜브 채널 관리.
 *
 * **넣기 전에 먼저 본다.** 주소를 붙여넣으면 최근 20편을 매일 도는 잡과 같은 규칙으로
 * 판정해서 "켜면 무엇이 올라가는지" 를 보여준다. 영상은 좋은데 제목 형식 때문에
 * 한 편도 안 잡히는 채널(테니스TV 가 그랬다)을 넣고 나서야 알게 되는 일을 막는다.
 *
 * **빼는 건 끄는 것이다.** 지우지 않는다. 왜 껐는지 메모가 남아야 같은 채널을 다시 알아보지 않는다.
 */

type ChannelRow = {
  uploads: string;
  title: string;
  handle: string | null;
  note: string;
  enabled: boolean;
  created_at: string;
  collected: number;
  posted: number;
  posted_30d: number;
  last_published: string | null;
};

type Preview = {
  channel: ResolvedChannel;
  existing: { enabled: boolean; note: string } | null;
  videos: PreviewVideo[];
};

const fetchChannels = () => adminFetch<{ channels: ChannelRow[] }>("/api/admin/channels");

export default function ChannelsPage() {
  const [rows, setRows] = useState<ChannelRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setRows((await fetchChannels()).channels);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    fetchChannels().then(
      (d) => alive && setRows(d.channels),
      (e: Error) => alive && setError(e.message),
    );
    return () => {
      alive = false;
    };
  }, []);

  const on = rows?.filter((r) => r.enabled) ?? [];
  const off = rows?.filter((r) => !r.enabled) ?? [];

  return (
    <div>
      <AddChannel onChanged={load} />

      {error && <p className="px-3 py-6 text-center text-ink-3">{error}</p>}
      {!rows && !error && <p className="py-10 text-center text-ink-3">불러오는 중</p>}

      {rows && (
        <>
          <Section
            title={`수집 중 ${on.length}`}
            hint="매일 아침 9시에 최근 업로드 20편을 훑습니다. 끄면 다음 수집부터 빠집니다."
          >
            {on.map((r) => (
              <ChannelItem key={r.uploads} row={r} onChanged={load} />
            ))}
          </Section>
          <Section title={`꺼 둔 채널 ${off.length}`} hint="검토했지만 넣지 않은 곳입니다. 왜 뺐는지 메모에 남아 있습니다.">
            {off.map((r) => (
              <ChannelItem key={r.uploads} row={r} onChanged={load} />
            ))}
          </Section>
        </>
      )}
    </div>
  );
}

function Section({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <section className="pt-6">
      <h2 className="px-3 text-[20px] leading-[26px] font-bold tracking-[-0.01em]">{title}</h2>
      <p className="px-3 pt-1 pb-2 text-[13px] leading-[18px] text-ink-3">{hint}</p>
      <ul>{children}</ul>
    </section>
  );
}

/* ─────────────────────────── 넣기 ─────────────────────────── */

function AddChannel({ onChanged }: { onChanged: () => Promise<void> }) {
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [note, setNote] = useState("");
  const [done, setDone] = useState<string | null>(null);

  async function look(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || busy) return;
    setBusy(true);
    setError(null);
    setPreview(null);
    setDone(null);
    try {
      setPreview(
        await adminFetch<Preview>("/api/admin/channels/preview", {
          method: "POST",
          body: JSON.stringify({ input }),
        }),
      );
      setNote("");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function add() {
    if (!preview || busy) return;
    setBusy(true);
    setError(null);
    try {
      await adminFetch("/api/admin/channels", {
        method: "POST",
        body: JSON.stringify({ input, note }),
      });
      setDone(`${preview.channel.title} 을(를) 넣었습니다. 내일 아침 수집부터 올라옵니다.`);
      setPreview(null);
      setInput("");
      await onChanged();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function enableExisting() {
    if (!preview || busy) return;
    setBusy(true);
    setError(null);
    try {
      await adminFetch(`/api/admin/channels/${preview.channel.uploads}`, {
        method: "PATCH",
        body: JSON.stringify({ enabled: true, ...(note.trim() ? { note } : {}) }),
      });
      setDone(`${preview.channel.title} 을(를) 다시 켰습니다.`);
      setPreview(null);
      setInput("");
      await onChanged();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="hair-b px-3 pt-4 pb-4">
      <form onSubmit={look} className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="youtube.com/@채널이름 을 붙여넣기"
          aria-label="유튜브 채널 주소"
          inputMode="url"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          className="hair h-10 min-w-0 grow rounded-full bg-grouped px-4 outline-none placeholder:text-muted"
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          className="h-10 shrink-0 cursor-pointer rounded-full bg-ink px-4 font-semibold text-bg disabled:opacity-40"
        >
          {busy && !preview ? "보는 중" : "미리보기"}
        </button>
      </form>

      {error && <p className="pt-3 text-ink-3">{error}</p>}
      {done && <p className="pt-3">{done}</p>}

      {preview && (
        <PreviewCard
          preview={preview}
          note={note}
          setNote={setNote}
          busy={busy}
          onAdd={add}
          onEnable={enableExisting}
          onCancel={() => setPreview(null)}
        />
      )}
    </div>
  );
}

function PreviewCard({
  preview,
  note,
  setNote,
  busy,
  onAdd,
  onEnable,
  onCancel,
}: {
  preview: Preview;
  note: string;
  setNote: (v: string) => void;
  busy: boolean;
  onAdd: () => void;
  onEnable: () => void;
  onCancel: () => void;
}) {
  const { channel, existing, videos } = preview;
  const match = videos.filter((v) => v.match);
  const now = match.filter((v) => v.fresh);
  const shorts = videos.filter((v) => v.seconds !== null && v.seconds <= 180).length;
  const last = videos[0]?.publishedAt;

  // 판정 한 줄. 숫자만 주면 "그래서 넣으라는 거야?" 가 남는다.
  const verdict =
    match.length === 0
      ? "제목에서 경기를 하나도 못 읽었습니다. 넣어도 올라가는 게 없습니다."
      : now.length === 0
        ? `경기 영상은 ${match.length}편 읽히지만 최근 30일 업로드가 없어 지금은 올라갈 게 없습니다. 다시 올리기 시작하면 잡힙니다.`
        : `켜면 지금 ${now.length}편이 올라갑니다.`;

  return (
    <div className="pt-4">
      <div className="flex items-center gap-3">
        {channel.thumbnailUrl && (
          // 유튜브 썸네일 서버를 그대로 쓴다. next/image 도메인 설정을 늘리지 않는다.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={channel.thumbnailUrl} alt="" className="h-12 w-12 shrink-0 rounded-full bg-grouped" />
        )}
        <div className="min-w-0 grow">
          <p className="truncate font-bold">{channel.title}</p>
          <p className="truncate text-[13px] leading-[18px] text-ink-3">
            {[
              channel.handle,
              channel.subscribers !== null && `구독 ${channel.subscribers.toLocaleString("ko-KR")}`,
              channel.videoCount !== null && `영상 ${channel.videoCount.toLocaleString("ko-KR")}`,
              last && `마지막 업로드 ${ago(last)}`,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
      </div>

      <div className="mt-3 rounded-2xl bg-grouped px-3.5 py-3">
        <p className="font-semibold">{verdict}</p>
        <p className="pt-1 text-[13px] leading-[18px] text-ink-3">
          최근 {videos.length}편 중 경기 영상 {match.length}편 · 그중 최근 30일 {now.length}편
          {shorts > 0 && ` · 쇼츠 ${shorts}편은 빼고 봅니다`}
        </p>
      </div>

      <ul className="pt-2">
        {videos.map((v) => (
          <li key={v.providerVideoId} className="flex gap-2.5 py-2">
            <span
              aria-label={v.match ? "올라감" : "안 올라감"}
              className={`mt-[3px] flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full text-[13px] leading-none font-bold ${
                v.match ? (v.fresh ? "bg-ball text-green-deep" : "bg-ink-3 text-bg") : "hair text-muted"
              }`}
            >
              {v.match ? "✓" : ""}
            </span>
            <div className="min-w-0 grow">
              <p className={`line-clamp-2 break-keep ${v.match ? "" : "text-ink-3"}`}>{v.title}</p>
              <p className="text-[13px] leading-[18px] text-ink-3">
                {[
                  ago(v.publishedAt),
                  length(v.seconds),
                  v.match
                    ? [v.parts.tournamentName, v.parts.division, v.parts.round].filter(Boolean).join(" · ")
                    : reason(v),
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
          </li>
        ))}
      </ul>

      {existing ? (
        <div className="pt-3">
          <p className="text-ink-3">
            이미 목록에 있습니다 ({existing.enabled ? "수집 중" : "꺼 둠"}).
            {existing.note && ` 메모: ${existing.note}`}
          </p>
          {!existing.enabled && (
            <>
              <NoteBox value={note} onChange={setNote} placeholder="다시 켜는 이유 (선택)" />
              <Buttons busy={busy} primary="다시 켜기" onPrimary={onEnable} onCancel={onCancel} />
            </>
          )}
        </div>
      ) : (
        <div className="pt-3">
          <NoteBox value={note} onChange={setNote} placeholder="왜 넣는지 메모 (선택) — 나중에 다시 볼 때 도움이 됩니다" />
          <Buttons busy={busy} primary="넣기" onPrimary={onAdd} onCancel={onCancel} />
        </div>
      )}
    </div>
  );
}

function NoteBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={2}
      maxLength={1000}
      className="hair mt-2 w-full resize-none rounded-2xl bg-grouped px-3.5 py-2.5 outline-none placeholder:text-muted"
    />
  );
}

function Buttons({
  busy,
  primary,
  onPrimary,
  onCancel,
}: {
  busy: boolean;
  primary: string;
  onPrimary: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="flex justify-end gap-2 pt-2">
      <button type="button" onClick={onCancel} className="hair h-[34px] cursor-pointer rounded-full px-4 font-semibold">
        취소
      </button>
      <button
        type="button"
        onClick={onPrimary}
        disabled={busy}
        className="h-[34px] cursor-pointer rounded-full bg-ink px-4 font-semibold text-bg disabled:opacity-40"
      >
        {primary}
      </button>
    </div>
  );
}

/** 왜 안 올라가는지. "안 됨" 만 보여주면 채널을 고칠지 해석기를 고칠지 알 수 없다. */
function reason(v: PreviewVideo): string {
  if (v.seconds === null) return "길이를 모름";
  if (v.seconds <= 180) return "쇼츠";
  return "제목에서 대회·부서를 못 읽음";
}

/* ─────────────────────────── 목록 ─────────────────────────── */

function ChannelItem({ row, onChanged }: { row: ChannelRow; onChanged: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState(row.note);
  const [error, setError] = useState<string | null>(null);

  async function patch(body: { enabled?: boolean; note?: string }) {
    setBusy(true);
    setError(null);
    try {
      await adminFetch(`/api/admin/channels/${row.uploads}`, { method: "PATCH", body: JSON.stringify(body) });
      await onChanged();
      setEditing(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const stats = row.enabled
    ? [
        `최근 30일 ${row.posted_30d}편 게시`,
        `전체 ${row.posted}편`,
        row.last_published ? `마지막 업로드 ${ago(row.last_published)}` : "아직 수집 전",
      ]
    : [row.posted > 0 ? `예전에 ${row.posted}편 게시` : null];

  return (
    <li className="hair-t px-3 py-3">
      <div className="flex items-start gap-3">
        <div className="min-w-0 grow">
          <a
            href={`https://www.youtube.com/channel/UC${row.uploads.slice(2)}`}
            target="_blank"
            rel="noreferrer"
            className={`font-semibold ${row.enabled ? "" : "text-ink-3"}`}
          >
            {row.title}
          </a>
          {stats.some(Boolean) && (
            <p className="text-[13px] leading-[18px] text-ink-3">{stats.filter(Boolean).join(" · ")}</p>
          )}
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => void patch({ enabled: !row.enabled })}
          className={`h-[34px] shrink-0 cursor-pointer rounded-full px-3.5 font-semibold disabled:opacity-40 ${
            row.enabled ? "hair" : "bg-ink text-bg"
          }`}
        >
          {row.enabled ? "끄기" : "켜기"}
        </button>
      </div>

      {editing ? (
        <>
          <NoteBox value={note} onChange={setNote} placeholder="메모" />
          <Buttons
            busy={busy}
            primary="저장"
            onPrimary={() => void patch({ note })}
            onCancel={() => {
              setNote(row.note);
              setEditing(false);
            }}
          />
        </>
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="mt-1 block cursor-pointer text-left text-[13px] leading-[18px] break-keep text-ink-2"
        >
          {row.note || <span className="text-muted">메모 남기기</span>}
        </button>
      )}
      {error && <p className="pt-1 text-[13px] leading-[18px] text-ink-3">{error}</p>}
    </li>
  );
}

/* ─────────────────────────── 표기 ─────────────────────────── */

function ago(iso: string): string {
  const days = Math.floor((Date.now() - Date.parse(iso)) / 86_400_000);
  if (days < 1) return "오늘";
  if (days < 30) return `${days}일 전`;
  if (days < 365) return `${Math.floor(days / 30)}개월 전`;
  return `${Math.floor(days / 365)}년 전`;
}

function length(seconds: number | null): string | null {
  if (seconds === null) return null;
  const m = Math.floor(seconds / 60);
  return m >= 1 ? `${m}분` : `${seconds}초`;
}
