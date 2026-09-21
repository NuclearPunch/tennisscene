import { ArrowUpRight, Box, Play } from "@/components/icons";
import { CourtThumb } from "./CourtThumb";
import { RankingList } from "./RankingList";
import type { Attachment as A, MatchSide, PodiumTeam } from "@/lib/types";

/*
 * 첨부는 전부 같은 그릇에 담긴다 — 지면과 같은 바탕, 0.5px 테두리, 12px 모서리.
 * 쓰레드의 링크 미리보기와 같은 무게다. 첨부가 본문보다 시끄러우면 안 된다.
 *
 * 글자 크기는 셋뿐이다: 13(메타) · 15(기본) · 20(카드의 주인공 한 줄).
 */

const won = (n: number) => n.toLocaleString("ko-KR");

const META = "text-[13px] leading-[18px] text-ink-3";

function Card({ children }: { children: React.ReactNode }) {
  return <div className="hair mt-2 overflow-hidden rounded-card">{children}</div>;
}

/**
 * 테니스공 색 표식. 이 앱에서 색이 가장 크게 쓰이는 곳이 이 작은 조각이다.
 * 밝은 바탕 위 옐로우 **글자**는 안 보이지만(1.1:1), 옐로우 **채움** 위 딥그린 글자는 9.6:1 이다.
 * 라이트·다크 어느 쪽에서도 같은 색이다.
 */
function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="num shrink-0 rounded-[5px] bg-ball px-1.5 text-[12px] leading-[20px] font-bold text-green-deep">
      {children}
    </span>
  );
}

/** 카드의 주인공 한 줄 — 1위, 우승. */
function Lead({
  eyebrow,
  mark,
  name,
  sub,
}: {
  eyebrow: string;
  mark: string;
  name: string;
  sub?: string;
}) {
  return (
    <div className="px-3 pt-2.5 pb-3">
      <p className={META}>{eyebrow}</p>
      <div className="mt-1 flex items-center gap-2">
        <Pill>{mark}</Pill>
        <p className="min-w-0 text-[20px] leading-[26px] font-bold tracking-[-0.01em]">
          {name}
        </p>
      </div>
      {sub && <p className={`mt-0.5 ${META}`}>{sub}</p>}
    </div>
  );
}

/** 카드 맨 아래 나가는 줄. 출처로 트래픽을 돌려준다. */
function OutLink({
  href,
  left,
  label,
}: {
  href: string;
  left: React.ReactNode;
  label: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="hair-t flex h-11 items-center gap-3 px-3 text-[13px] leading-[18px]"
    >
      <span className="min-w-0 grow truncate text-ink-3">{left}</span>
      <span className="flex shrink-0 items-center gap-0.5 font-semibold">
        {label}
        <ArrowUpRight className="h-3.5 w-3.5" />
      </span>
    </a>
  );
}

function Ranking({ a }: { a: Extract<A, { type: "ranking" }> }) {
  // 카토 챌린저부 · 38주차 — 어느 단체의 랭킹인지가 먼저 보여야 한다.
  // 단체마다 부수 체계가 다르고 랭킹도 따로 돌아간다(docs/DECISIONS.md).
  const scope = [a.org, a.region, a.division].filter(Boolean).join(" ");

  return (
    <Card>
      <Lead
        eyebrow={`${scope} · ${a.week}`}
        // 1위가 이름 비공개면 그다음 선수가 올라오되 순위는 원래 값을 지킨다.
        mark={`${a.leader.rank}위`}
        name={a.leader.name}
        sub={[a.leader.club, a.story].filter(Boolean).join(" · ") || undefined}
      />
      {a.runnersUp.length > 0 && <RankingList rows={a.runnersUp} />}
    </Card>
  );
}

function PodiumRow({ label, team }: { label: string; team: PodiumTeam }) {
  return (
    <div className="hair-t flex gap-3 px-3 py-2">
      <span className={`w-[50px] shrink-0 pt-0.5 ${META}`}>{label}</span>
      <div className="min-w-0 grow">
        <p className="truncate">{team.names}</p>
        {team.clubs && <p className={`truncate ${META}`}>{team.clubs}</p>}
      </div>
    </div>
  );
}

function Result({ a }: { a: Extract<A, { type: "result" }> }) {
  return (
    <Card>
      <Lead
        eyebrow={[a.scope, a.dateLabel].filter(Boolean).join(" · ")}
        mark="우승"
        name={a.champion.names}
        sub={a.champion.clubs}
      />
      {a.runnerUp && <PodiumRow label="준우승" team={a.runnerUp} />}
      {a.semifinalists.map((t) => (
        <PodiumRow key={t.names} label="공동 3위" team={t} />
      ))}
      {/* 8강부터는 담지 않는다. 더 보고 싶으면 원문 대진표로 보낸다. */}
      <OutLink href={a.sourceUrl} left={a.tournament} label="대진표" />
    </Card>
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
    <Card>
      <div className="px-3 pt-2.5 pb-3">
        <p className="font-semibold">{a.name}</p>
        <p className={`mt-0.5 ${META}`}>
          {[a.dateLabel, a.venue].filter(Boolean).join(" · ")}
        </p>
        {a.divisions.length > 0 && (
          <p className={META}>{a.divisions.join(" · ")}</p>
        )}
      </div>
      <OutLink
        href={a.sourceUrl}
        left={
          <span className={`flex items-center gap-1.5 ${open ? "text-ink" : ""}`}>
            {open && <span className="h-1.5 w-1.5 rounded-full bg-green-hi" />}
            {STATUS_LABEL[a.status]}
          </span>
        }
        label={open ? "신청하러 가기" : "대회 요강"}
      />
    </Card>
  );
}

function Video({ a }: { a: Extract<A, { type: "video" }> }) {
  // 재생은 유튜브에서 한다(API 약관). 눌러서 나가고, 우리는 썸네일만 보여준다.
  const meta = [a.channel, a.duration].filter(Boolean).join(" · ");
  const tag = [a.tournament, a.division, a.round].filter(Boolean).join(" · ");

  return (
    <Card>
      <a href={a.watchUrl} target="_blank" rel="noopener noreferrer" className="block">
        <div className="relative h-[190px] w-full bg-grouped">
          {a.thumbnailUrl ? (
            // 썸네일은 유튜브에서 바로 가져온다. 우리 서버에 저장하지 않는다.
            // eslint-disable-next-line @next/next/no-img-element -- 외부 CDN 이라 next/image 최적화 대상이 아니다
            <img
              src={a.thumbnailUrl}
              alt=""
              loading="lazy"
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <CourtThumb className="absolute inset-0 block h-full w-full" />
          )}
          <span className="absolute top-1/2 left-1/2 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-white">
            <Play className="h-5 w-5" />
          </span>
        </div>
        <div className="hair-t px-3 pt-2.5 pb-3">
          {tag && <p className={META}>{tag}</p>}
          <p className="font-semibold">{a.title}</p>
          {meta && <p className={`mt-0.5 ${META}`}>{meta}</p>}
        </div>
      </a>
    </Card>
  );
}

function Gear({ a }: { a: Extract<A, { type: "gear" }> }) {
  return (
    <Card>
      <div className="flex items-center gap-3 p-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-media bg-grouped text-ink-3">
          <Box className="h-6 w-6" />
        </div>
        <div className="min-w-0 grow">
          <p className="truncate font-semibold">{a.product}</p>
          <p className={`truncate ${META}`}>{a.spec}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="num font-semibold">{won(a.price)}원</p>
          {a.wasPrice && (
            <p className={`num line-through ${META}`}>{won(a.wasPrice)}원</p>
          )}
        </div>
      </div>
    </Card>
  );
}

const setsWon = (me: number[], other: number[]) =>
  me.filter((g, i) => g > (other[i] ?? 0)).length;

// Score 안에 두면 렌더마다 새 컴포넌트 타입이 만들어져 상태가 리셋된다. 밖에 둔다.
function ScoreRow({ side, opponent }: { side: MatchSide; opponent: MatchSide }) {
  return (
    <div className={`flex items-center gap-3 ${side.won ? "" : "text-ink-3"}`}>
      <span className={`min-w-0 grow truncate ${side.won ? "font-semibold" : ""}`}>
        {side.name}
      </span>
      <span className="num text-[13px] leading-[18px] text-ink-3">
        {side.sets.join("  ")}
      </span>
      <span className={`num w-4 text-right ${side.won ? "font-bold" : ""}`}>
        {setsWon(side.sets, opponent.sets)}
      </span>
    </div>
  );
}

function Score({ a }: { a: Extract<A, { type: "score" }> }) {
  return (
    <Card>
      <div className="px-3 pt-2.5 pb-3">
        <p className={META}>{a.event}</p>
        <div className="mt-1.5 flex flex-col gap-1">
          <ScoreRow side={a.home} opponent={a.away} />
          <ScoreRow side={a.away} opponent={a.home} />
        </div>
      </div>
    </Card>
  );
}

function Weather({ a }: { a: Extract<A, { type: "weather" }> }) {
  // 카드에 담지 않는다. 숫자 셋은 글 한 줄이면 된다.
  return (
    <p className="num text-ink-3">
      {a.temp}° · 강수 {a.rainChance}% · 풍속 {a.wind}
    </p>
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
    case "result":
      return <Result a={a} />;
    case "tournament":
      return <Tournament a={a} />;
    case "weather":
      return <Weather a={a} />;
  }
}
