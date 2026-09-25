"use client";

import { useCallback, useEffect, useState } from "react";
import { adminFetch } from "@/lib/adminFetch";

/**
 * 수집 기록.
 *
 * 크론이 도는지는 Vercel 로그를 뒤져야만 알 수 있었다. 이제 잡 하나가 끝날 때마다
 * 한 줄씩 남는다(`job_runs`). **맨 위에는 "오늘 아침에 돌았나" 하나만 크게 둔다** —
 * 운영자가 매일 알고 싶은 건 그것 하나다.
 */

type Run = {
  id: number;
  job: string;
  trigger: "cron" | "manual";
  ok: boolean;
  summary: string;
  lines: string[];
  duration_ms: number;
  started_at: string;
};

const LABEL: Record<string, string> = {
  tournaments: "대회 일정",
  youtube: "경기 영상",
  results: "대회 결과",
  snapshot: "랭킹 수집",
  publish: "랭킹 게시",
  ai: "AI 계정 글",
  purge: "오래된 글 정리",
  push: "알림 전달 확인",
};

/** 손으로 돌릴 수 있는 것. 랭킹은 월요일 크론만 돌린다(주간 다이제스트). */
const RUNNABLE = [
  { job: "youtube", note: "몇 초" },
  { job: "tournaments", note: "몇 초" },
  { job: "results", note: "30초 넘게 걸립니다 — 카토에 천천히 묻습니다" },
  { job: "ai", note: "오늘 차례인 AI 계정이 한 편씩 씁니다. 하루에 한 번만 씁니다" },
];

/** 크론은 매일 09:00 KST. 이보다 오래 기록이 없으면 안 돈 것이다. */
const CRON_GAP_HOURS = 26;

const fetchRuns = () => adminFetch<{ runs: Run[] }>("/api/admin/jobs");

export default function JobsPage() {
  const [runs, setRuns] = useState<Run[] | null>(null);
  // "지금" 은 기록을 받아온 시각이다. 렌더할 때마다 시계를 보면 같은 화면이 매번 달라진다.
  const [checkedAt, setCheckedAt] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState<string | null>(null);
  const [result, setResult] = useState<{ job: string; ok: boolean; text: string } | null>(null);

  const show = useCallback((r: Run[]) => {
    setRuns(r);
    setCheckedAt(Date.now());
    setError(null);
  }, []);

  const load = useCallback(async () => {
    try {
      show((await fetchRuns()).runs);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [show]);

  useEffect(() => {
    let alive = true;
    fetchRuns().then(
      (d) => alive && show(d.runs),
      (e: Error) => alive && setError(e.message),
    );
    return () => {
      alive = false;
    };
  }, [show]);

  async function run(job: string) {
    if (running) return;
    setRunning(job);
    setResult(null);
    try {
      const r = await adminFetch<{ ok: boolean; summary: string; ms: number }>(`/api/admin/jobs/${job}`, {
        method: "POST",
      });
      setResult({ job, ok: r.ok, text: `${r.summary} (${(r.ms / 1000).toFixed(1)}초)` });
    } catch (e) {
      setResult({ job, ok: false, text: (e as Error).message });
    } finally {
      setRunning(null);
      await load();
    }
  }

  const lastCron = runs?.find((r) => r.trigger === "cron");
  const cronFailed = lastCron ? runs!.filter((r) => r.trigger === "cron" && sameMorning(r, lastCron) && !r.ok) : [];
  const stale = !lastCron || checkedAt - Date.parse(lastCron.started_at) > CRON_GAP_HOURS * 3600_000;

  return (
    <div>
      {runs && (
        <div className="px-3 pt-4">
          <div className="rounded-2xl bg-grouped px-3.5 py-3">
            <p className="font-semibold">
              {!lastCron
                ? "아직 자동 수집 기록이 없습니다"
                : stale
                  ? `자동 수집이 ${ago(lastCron.started_at)} 이후 돌지 않았습니다`
                  : cronFailed.length > 0
                    ? `오늘 아침 수집 중 ${cronFailed.map((r) => LABEL[r.job] ?? r.job).join(", ")} 이(가) 실패했습니다`
                    : `자동 수집 정상 · ${clock(lastCron.started_at)}`}
            </p>
            <p className="pt-1 text-[13px] leading-[18px] text-ink-3">
              {!lastCron
                ? "기록은 이번 배포부터 쌓입니다. 내일 아침 9시에 첫 줄이 생깁니다."
                : stale
                  ? "Vercel 크론 설정과 CRON_SECRET 을 확인해 주세요."
                  : "매일 아침 9시에 돕니다. 월요일에는 랭킹도 같이 돕니다."}
            </p>
          </div>
        </div>
      )}

      <section className="pt-6">
        <h2 className="px-3 text-[20px] leading-[26px] font-bold tracking-[-0.01em]">지금 돌리기</h2>
        <p className="px-3 pt-1 pb-2 text-[13px] leading-[18px] text-ink-3">
          채널을 넣었거나 아침 수집이 실패했을 때 씁니다. 여러 번 눌러도 같은 글이 두 번 올라가지 않고,
          새 글은 한꺼번에 뜨지 않고 오늘 밤까지 나눠 올라갑니다.
        </p>
        <ul>
          {RUNNABLE.map(({ job, note }) => (
            <li key={job} className="hair-t flex items-center gap-3 px-3 py-3">
              <div className="min-w-0 grow">
                <p className="font-semibold">{LABEL[job]}</p>
                <p className="text-[13px] leading-[18px] text-ink-3">
                  {result?.job === job ? result.text : note}
                </p>
              </div>
              <button
                type="button"
                disabled={running !== null}
                onClick={() => void run(job)}
                className="hair h-[34px] shrink-0 cursor-pointer rounded-full px-3.5 font-semibold disabled:opacity-40"
              >
                {running === job ? "도는 중" : "돌리기"}
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="pt-6 pb-10">
        <h2 className="px-3 text-[20px] leading-[26px] font-bold tracking-[-0.01em]">기록</h2>
        {error && <p className="px-3 py-6 text-ink-3">{error}</p>}
        {!runs && !error && <p className="py-10 text-center text-ink-3">불러오는 중</p>}
        {runs?.length === 0 && <p className="px-3 py-6 text-ink-3">아직 기록이 없습니다.</p>}
        <ul className="pt-2">
          {runs?.map((r) => (
            <RunItem key={r.id} run={r} />
          ))}
        </ul>
      </section>
    </div>
  );
}

function RunItem({ run }: { run: Run }) {
  const [open, setOpen] = useState(false);
  const lines = Array.isArray(run.lines) ? run.lines : [];
  return (
    <li className="hair-t px-3 py-3">
      <button
        type="button"
        onClick={() => lines.length > 0 && setOpen(!open)}
        className={`block w-full text-left ${lines.length > 0 ? "cursor-pointer" : "cursor-default"}`}
      >
        <p className="text-[13px] leading-[18px] text-ink-3">
          {clock(run.started_at)} · {run.trigger === "cron" ? "자동" : "손으로"} · {(run.duration_ms / 1000).toFixed(1)}초
        </p>
        <p>
          <span className="font-semibold">{LABEL[run.job] ?? run.job}</span>{" "}
          {!run.ok && <span className="font-semibold">실패 · </span>}
          <span className={run.ok ? "text-ink-2" : ""}>{run.summary}</span>
        </p>
      </button>
      {open && (
        <pre className="mt-2 overflow-x-auto rounded-xl bg-grouped px-3 py-2 text-[13px] leading-[18px] whitespace-pre-wrap text-ink-2">
          {lines.join("\n")}
        </pre>
      )}
    </li>
  );
}

/** 같은 아침 크론의 다른 잡들. 한 번 도는 데 1분이 안 걸리므로 10분 안이면 같은 회차다. */
function sameMorning(a: Run, b: Run): boolean {
  return Math.abs(Date.parse(a.started_at) - Date.parse(b.started_at)) < 10 * 60_000;
}

function clock(iso: string): string {
  return new Date(iso).toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "numeric",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ago(iso: string): string {
  const h = Math.floor((Date.now() - Date.parse(iso)) / 3600_000);
  return h < 24 ? `${h}시간 전` : `${Math.floor(h / 24)}일 전`;
}
