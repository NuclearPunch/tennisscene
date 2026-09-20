import { ArrowUpRight, BallTexture, Box, Play } from "@/components/icons";
import { CourtThumb } from "./CourtThumb";
import { RankingList } from "./RankingList";
import type { Attachment as A } from "@/lib/types";

const won = (n: number) => n.toLocaleString("ko-KR");

function Ranking({ a }: { a: Extract<A, { type: "ranking" }> }) {
  // 카토 챌린저부 · 38주차 — 어느 단체의 랭킹인지가 먼저 보여야 한다.
  // 단체마다 부수 체계가 다르고 랭킹도 따로 돌아간다(docs/DECISIONS.md).
  const scope = [a.org, a.region, a.division].filter(Boolean).join(" ");

  return (
    <>
      <div className="relative mt-0.5 rounded-panel bg-green-deep p-5 overflow-hidden">
        <BallTexture className="absolute -right-10 -top-11 w-[150px] h-[150px] opacity-[0.14]" />
        <p className="relative text-[10.5px] font-semibold tracking-[0.1em] text-ball">
          {scope} · {a.week}
        </p>
        <p className="relative mt-1 text-[32px] font-bold tracking-[-0.03em] leading-[1.14] text-white">
          {a.leader.name}
        </p>
        <p className="relative text-[13px] text-on-deep">
          {[a.leader.club, a.story].filter(Boolean).join(" · ")}
        </p>
      </div>

      {a.runnersUp.length > 0 && <RankingList rows={a.runnersUp} />}
    </>
  );
}

function Video({ a }: { a: Extract<A, { type: "video" }> }) {
  return (
    <div className="mt-0.5 rounded-panel overflow-hidden bg-[#edf2ef]">
      <div className="relative w-full h-[178px]">
        <CourtThumb className="absolute inset-0 w-full h-full block" />
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[50px] h-[50px] rounded-full bg-white/[0.93] shadow-[0_2px_10px_rgba(14,26,20,0.12)] flex items-center justify-center">
          <Play className="w-[17px] h-[17px] text-ink" />
        </div>
      </div>
      <div className="bg-surface px-3.5 py-3">
        <p className="text-[13.5px] font-semibold leading-[1.4] tracking-[-0.01em]">
          {a.title}
        </p>
        <p className="mt-0.5 text-[11.5px] text-ink-3">
          {a.channel} · {a.duration} · {a.source}
        </p>
      </div>
    </div>
  );
}

function Gear({ a }: { a: Extract<A, { type: "gear" }> }) {
  return (
    <div className="mt-0.5 flex items-center gap-3 rounded-card border border-hairline bg-surface px-3 py-3">
      <div className="shrink-0 w-11 h-11 rounded-[10px] bg-grouped flex items-center justify-center text-[#9fb3a8]">
        <Box className="w-6 h-6" />
      </div>
      <div className="grow min-w-0">
        <p className="text-[13.5px] font-semibold leading-snug tracking-[-0.01em]">
          {a.product}
        </p>
        <p className="mt-0.5 truncate text-[11.5px] text-ink-3">{a.spec}</p>
      </div>
      <div className="shrink-0 text-right">
        <p className="num text-[15px] font-semibold tracking-[-0.015em] text-green">
          {won(a.price)}
        </p>
        {a.wasPrice && (
          <p className="num text-[11px] text-ink-4 line-through">{won(a.wasPrice)}</p>
        )}
      </div>
    </div>
  );
}

function Score({ a }: { a: Extract<A, { type: "score" }> }) {
  const setsWon = (me: number[], other: number[]) =>
    me.filter((g, i) => g > (other[i] ?? 0)).length;

  const Row = ({
    side,
    opponent,
  }: {
    side: (typeof a)["home"];
    opponent: (typeof a)["home"];
  }) => (
    <div className="flex items-center gap-3">
      <span
        className={`grow text-[14.5px] ${side.won ? "font-semibold" : "text-ink-2"}`}
      >
        {side.name}
      </span>
      <span className={`num text-[13.5px] ${side.won ? "text-ink-2" : "text-ink-4"}`}>
        {side.sets.join("  ")}
      </span>
      <span
        className={`num w-3.5 text-right text-base ${side.won ? "font-bold text-green" : "text-ink-4"}`}
      >
        {setsWon(side.sets, opponent.sets)}
      </span>
    </div>
  );

  return (
    <div className="mt-0.5 rounded-card border border-hairline bg-surface px-4 py-3.5">
      <p className="num mb-2.5 text-[10.5px] font-semibold tracking-[0.1em] text-ink-4">
        {a.event}
      </p>
      <div className="flex flex-col gap-2.5">
        <Row side={a.home} opponent={a.away} />
        <div className="h-px bg-hairline" />
        <Row side={a.away} opponent={a.home} />
      </div>
    </div>
  );
}

const STATUS_LABEL = {
  open: "접수 중",
  upcoming: "접수 예정",
  closed: "접수 마감",
} as const;

function Tournament({ a }: { a: Extract<A, { type: "tournament" }> }) {
  const open = a.status === "open";
  return (
    <div className="mt-0.5 overflow-hidden rounded-card border border-hairline bg-surface">
      <div className="px-3.5 py-3">
        <p className="text-[14.5px] font-semibold leading-[1.4] tracking-[-0.01em]">
          {a.name}
        </p>
        <p className="mt-1 text-[11.5px] text-ink-3">
          {[a.dateLabel, a.venue].filter(Boolean).join(" · ")}
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {a.divisions.map((d) => (
            <span
              key={d}
              className="rounded-md bg-grouped px-2 py-1 text-[11px] text-ink-2"
            >
              {d}
            </span>
          ))}
        </div>
      </div>
      <a
        href={a.sourceUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={`flex items-center gap-2 border-t border-hairline px-3.5 py-2.5 ${
          open ? "bg-green-bg" : "bg-grouped"
        }`}
      >
        <span
          className={`grow text-xs ${open ? "font-medium text-green-deep" : "text-ink-3"}`}
        >
          {STATUS_LABEL[a.status]}
        </span>
        <span
          className={`flex items-center gap-1 text-xs font-medium ${
            open ? "text-green-deep" : "text-ink-2"
          }`}
        >
          {open ? "신청하러 가기" : "대회 요강"}
          <ArrowUpRight className="h-3.5 w-3.5" />
        </span>
      </a>
    </div>
  );
}

function Weather({ a }: { a: Extract<A, { type: "weather" }> }) {
  return (
    <div className="flex items-center gap-3.5 text-[12.5px] text-ink-2">
      <span className="num text-sm font-medium text-ink">{a.temp}°</span>
      <span>강수 {a.rainChance}%</span>
      <span>풍속 {a.wind}</span>
    </div>
  );
}

export function Attachment({ a }: { a: A }) {
  switch (a.type) {
    case "ranking":
      return <Ranking a={a} />;
    case "video":
      return <Video a={a} />;
    case "gear":
      return <Gear a={a} />;
    case "score":
      return <Score a={a} />;
    case "tournament":
      return <Tournament a={a} />;
    case "weather":
      return <Weather a={a} />;
  }
}
