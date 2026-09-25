"use client";

import { useCallback, useEffect, useState } from "react";
import { adminFetch } from "@/lib/adminFetch";

/**
 * 신고 처리 — 애플 1.2 "신고에 제때 대응".
 *
 * 신고가 기준(익명 2건·실명 3건)에 차면 이미 자동으로 가려져 있다. 여기서 확정하거나 되살린다.
 * 익명 글도 실제 작성자를 보여준다 — 반복해서 신고되는 사람을 알아야 한다. 이 화면 밖으로는 안 나간다.
 */
type Row = {
  post_id: string;
  type: string;
  body: string | null;
  title: string | null;
  is_anonymous: boolean;
  author_handle: string;
  author_name: string;
  author_kind: string;
  created_at: string;
  report_count: number;
  reasons: string[];
  last_reported_at: string;
  hidden: boolean;
  auto_hidden: boolean;
};

const fetchQueue = () => adminFetch<{ reports: Row[] }>("/api/admin/reports");

export default function ReportsPage() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetchQueue().then(
      (d) => alive && setRows(d.reports),
      (e: Error) => alive && setError(e.message),
    );
    return () => {
      alive = false;
    };
  }, []);

  const done = useCallback((id: string) => setRows((prev) => prev?.filter((r) => r.post_id !== id) ?? prev), []);

  return (
    <div className="pb-10">
      <p className="px-3 pt-4 pb-2 text-[13px] leading-[18px] text-ink-3">
        신고가 들어온 글입니다. 익명 글은 2건, 실명 글은 3건이 되면 자동으로 가려집니다. 되도록 하루 안에 처리해 주세요.
      </p>
      {error && <p className="px-3 py-6 text-ink-3">{error}</p>}
      {!rows && !error && <p className="py-10 text-center text-ink-3">불러오는 중</p>}
      {rows?.length === 0 && <p className="px-3 py-10 text-center text-ink-3">처리할 신고가 없습니다</p>}
      <ul>
        {rows?.map((r) => (
          <Item key={r.post_id} row={r} onDone={() => done(r.post_id)} />
        ))}
      </ul>
    </div>
  );
}

function Item({ row, onDone }: { row: Row; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [suspended, setSuspended] = useState<string | null>(null);

  async function suspend() {
    if (!window.confirm("이 글을 쓴 회원의 이용을 정지할까요? 정지되면 글과 댓글을 쓸 수 없습니다.")) return;
    setBusy(true);
    setError(null);
    try {
      const r = await adminFetch<{ handle: string }>(`/api/admin/reports/${row.post_id}/suspend`, {
        method: "POST",
        body: JSON.stringify({ reason: row.reasons.join(", ") }),
      });
      setSuspended(r.handle);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function resolve(verdict: "remove" | "keep") {
    setBusy(true);
    setError(null);
    try {
      await adminFetch(`/api/admin/reports/${row.post_id}`, { method: "PATCH", body: JSON.stringify({ verdict }) });
      onDone();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <li className="hair-t px-3 py-3">
      <p className="text-[13px] leading-[18px] text-ink-3">
        {[
          `신고 ${row.report_count}건`,
          row.reasons.join(", "),
          row.hidden ? (row.auto_hidden ? "자동으로 가려짐" : "가려짐") : "아직 보임",
        ].join(" · ")}
      </p>
      <p className="mt-0.5 text-[13px] leading-[18px] text-ink-3">
        {row.is_anonymous ? `익명 (실제: ${row.author_name} @${row.author_handle})` : `${row.author_name} @${row.author_handle}`}
      </p>
      <p className="mt-1 line-clamp-4 whitespace-pre-line break-keep">{row.body || row.title || "(내용 없음)"}</p>
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void resolve("keep")}
          className="hair h-[34px] cursor-pointer rounded-full px-3.5 font-semibold disabled:opacity-40"
        >
          {row.hidden ? "문제없음 · 되살리기" : "문제없음"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void resolve("remove")}
          className="h-[34px] cursor-pointer rounded-full bg-ink px-3.5 font-semibold text-bg disabled:opacity-40"
        >
          {row.hidden ? "내림 확정" : "내리기"}
        </button>
        {row.author_kind === "user" && !suspended && !row.author_name.endsWith("(정지됨)") && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void suspend()}
            className="ml-auto h-[34px] cursor-pointer rounded-full px-3.5 font-semibold text-down disabled:opacity-40"
          >
            작성자 이용 정지
          </button>
        )}
      </div>
      {suspended && <p className="pt-1 text-[13px] leading-[18px]">{`@${suspended} 의 이용을 정지했습니다.`}</p>}
      {error && <p className="pt-1 text-[13px] leading-[18px] text-down">{error}</p>}
    </li>
  );
}
