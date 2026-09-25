"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { adminFetch } from "@/lib/adminFetch";

/**
 * 글 관리 — 숨기기·되살리기.
 *
 * 봇이 잘못 올린 글(28초 쇼츠가 "결승 경기 영상" 으로 올라간 적이 있다)을
 * SQL 없이 내린다. 숨기면 피드·검색·상세에서 전부 빠진다.
 *
 * **되살리기는 관리자가 숨긴 글만 된다.** 작성자가 스스로 지운 글은 목록에도 안 나오고
 * DB 도 거절한다 — 본인이 지운 글을 운영자가 되살리면 안 된다.
 */

type Row = {
  id: string;
  type: string;
  author_handle: string;
  author_name: string;
  author_kind: "bot" | "brand" | "user";
  body: string | null;
  title: string | null;
  created_at: string;
  like_count: number;
  comment_count: number;
  hidden: boolean | null;
  hidden_reason: string | null;
};

const TYPE: Record<string, string> = {
  text: "글",
  ranking: "주간 랭킹",
  tournament: "대회 일정",
  result: "대회 결과",
  video: "경기 영상",
};

/** 서버(admin_recent_posts 호출)가 한 번에 주는 수. 이만큼 왔으면 더 있을 수 있다. */
const PAGE = 30;

const fetchPosts = (before?: string) =>
  adminFetch<{ posts: Row[] }>(`/api/admin/posts${before ? `?before=${encodeURIComponent(before)}` : ""}`);

export default function PostsPage() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [more, setMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // "예약" 을 가르는 기준 시각. 목록을 받아온 때로 고정한다 — 렌더마다 시계를 보면 화면이 흔들린다.
  const [loadedAt, setLoadedAt] = useState(0);

  const append = useCallback((posts: Row[], before?: string) => {
    if (!before) setLoadedAt(Date.now());
    setRows((prev) => (before && prev ? [...prev, ...posts] : posts));
    setMore(posts.length === PAGE);
    setError(null);
  }, []);

  /** 더 보기. 첫 화면은 아래 effect 가 받는다. */
  const load = useCallback(
    async (before: string) => {
      setLoading(true);
      try {
        append((await fetchPosts(before)).posts, before);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    },
    [append],
  );

  useEffect(() => {
    let alive = true;
    fetchPosts().then(
      (d) => alive && append(d.posts),
      (e: Error) => alive && setError(e.message),
    );
    return () => {
      alive = false;
    };
  }, [append]);

  function replace(id: string, patch: Partial<Row>) {
    setRows((prev) => prev?.map((r) => (r.id === id ? { ...r, ...patch } : r)) ?? prev);
  }

  return (
    <div className="pb-10">
      <p className="px-3 pt-4 pb-2 text-[13px] leading-[18px] text-ink-3">
        최근 글입니다. 봇 글은 하루에 걸쳐 나눠 올라가서, 맨 위에는 아직 안 뜬 예약 글이 보입니다.
        숨기면 피드·검색·상세에서 모두 빠지고, 여기서 다시 되살릴 수 있습니다.
      </p>
      {error && <p className="px-3 py-6 text-ink-3">{error}</p>}
      <ul>
        {rows?.map((r) => (
          <PostItem key={r.id} row={r} now={loadedAt} onChange={(p) => replace(r.id, p)} />
        ))}
      </ul>
      {rows && more && (
        <div className="flex justify-center pt-4">
          <button
            type="button"
            disabled={loading}
            onClick={() => void load(rows[rows.length - 1].created_at)}
            className="hair h-[34px] cursor-pointer rounded-full px-4 font-semibold disabled:opacity-40"
          >
            {loading ? "불러오는 중" : "더 보기"}
          </button>
        </div>
      )}
      {!rows && !error && <p className="py-10 text-center text-ink-3">불러오는 중</p>}
    </div>
  );
}

function PostItem({ row, now, onChange }: { row: Row; now: number; onChange: (p: Partial<Row>) => void }) {
  const [asking, setAsking] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function set(hidden: boolean) {
    setBusy(true);
    setError(null);
    try {
      await adminFetch(`/api/admin/posts/${row.id}`, {
        method: "PATCH",
        body: JSON.stringify({ hidden, ...(hidden ? { reason } : {}) }),
      });
      onChange({ hidden, hidden_reason: hidden ? reason.trim() || null : null });
      setAsking(false);
      setReason("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const text = row.body || row.title || "";
  // 아직 예약 시각이 안 된 글. 피드에는 안 보이고 여기서만 보인다 — 뜨기 전에 뺄 수 있다.
  const scheduled = Date.parse(row.created_at) > now;
  return (
    <li className={`hair-t px-3 py-3 ${row.hidden ? "opacity-60" : ""}`}>
      <div className="flex items-start gap-3">
        <div className="min-w-0 grow">
          <p className="text-[13px] leading-[18px] text-ink-3">
            {[
              row.author_name,
              TYPE[row.type] ?? row.type,
              scheduled ? `${when(row.created_at)} 예약` : when(row.created_at),
              (row.like_count > 0 || row.comment_count > 0) && `좋아요 ${row.like_count} · 댓글 ${row.comment_count}`,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
          {row.hidden || scheduled ? (
            <p className="line-clamp-3 break-keep whitespace-pre-line">{text}</p>
          ) : (
            <Link href={`/p/${row.id}`} className="line-clamp-2 break-keep">
              {text}
            </Link>
          )}
          {row.hidden && (
            <p className="pt-0.5 text-[13px] leading-[18px] font-semibold">
              숨김{row.hidden_reason ? ` · ${row.hidden_reason}` : ""}
            </p>
          )}
        </div>
        {!asking && (
          <button
            type="button"
            disabled={busy}
            onClick={() => (row.hidden ? void set(false) : setAsking(true))}
            className="hair h-[34px] shrink-0 cursor-pointer rounded-full px-3.5 font-semibold disabled:opacity-40"
          >
            {row.hidden ? "되살리기" : "숨기기"}
          </button>
        )}
      </div>

      {asking && (
        <div className="flex gap-2 pt-2">
          <input
            autoFocus
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.nativeEvent.isComposing && void set(true)}
            placeholder="숨기는 이유 (선택)"
            maxLength={300}
            className="hair h-[34px] min-w-0 grow rounded-full bg-grouped px-3.5 outline-none placeholder:text-muted"
          />
          <button
            type="button"
            onClick={() => setAsking(false)}
            className="hair h-[34px] shrink-0 cursor-pointer rounded-full px-3.5 font-semibold"
          >
            취소
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void set(true)}
            className="h-[34px] shrink-0 cursor-pointer rounded-full bg-ink px-3.5 font-semibold text-bg disabled:opacity-40"
          >
            숨기기
          </button>
        </div>
      )}
      {error && <p className="pt-1 text-[13px] leading-[18px] text-ink-3">{error}</p>}
    </li>
  );
}

function when(iso: string): string {
  return new Date(iso).toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
