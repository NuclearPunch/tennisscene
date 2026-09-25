import { Image } from "expo-image";
import * as WebBrowser from "expo-web-browser";
import { ArrowUpRight, CaretDown, CaretUp, Package, Play } from "phosphor-react-native";
import { useState } from "react";
import { Linking, Pressable, StyleSheet, View } from "react-native";
import { T } from "@/components/T";
import { BRAND, HAIR, RADIUS, useColors } from "@/lib/theme";
import type { Attachment as A, MatchSide, PodiumTeam, RankRow } from "@/lib/types";

/*
 * 첨부는 웹(src/components/post/Attachment.tsx)과 같은 그릇에 담긴다 —
 * 지면과 같은 바탕, 0.5pt 테두리, 12pt 모서리. 첨부가 본문보다 시끄러우면 안 된다.
 */

function Card({ children }: { children: React.ReactNode }) {
  const c = useColors();
  return (
    <View
      style={{
        marginTop: 8,
        borderWidth: HAIR,
        borderColor: c.hairline,
        borderRadius: RADIUS.card,
        overflow: "hidden",
      }}
    >
      {children}
    </View>
  );
}

function Rule() {
  const c = useColors();
  return <View style={{ height: HAIR, backgroundColor: c.hairline }} />;
}

/** 테니스공 색 표식. 옐로우 채움 위 딥그린 글자(9.6:1). 라이트·다크 어느 쪽에서도 같은 색이다. */
function Pill({ children }: { children: string }) {
  return (
    <View style={{ backgroundColor: BRAND.ball, borderRadius: 5, paddingHorizontal: 6 }}>
      <T w="700" color={BRAND.greenDeep} style={{ fontSize: 12, lineHeight: 20 }}>
        {children}
      </T>
    </View>
  );
}

/** 카드의 주인공 한 줄 — 1위, 우승. */
function Lead({ eyebrow, mark, name, sub }: { eyebrow: string; mark: string; name: string; sub?: string }) {
  return (
    <View style={{ paddingHorizontal: 12, paddingTop: 10, paddingBottom: 12 }}>
      <T v="small" c="ink3">
        {eyebrow}
      </T>
      <View style={{ marginTop: 4, flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Pill>{mark}</Pill>
        <T v="lead" w="700" style={{ flexShrink: 1 }}>
          {name}
        </T>
      </View>
      {sub ? (
        <T v="small" c="ink3" style={{ marginTop: 2 }}>
          {sub}
        </T>
      ) : null}
    </View>
  );
}

/** 원문을 여는 줄. 앱 안의 브라우저로 연다 — 앱을 떠나지 않게. */
function OutLink({ href, left, label }: { href: string; left: React.ReactNode; label: string }) {
  const c = useColors();
  return (
    <>
      <Rule />
      <Pressable
        onPress={() => void WebBrowser.openBrowserAsync(href)}
        style={({ pressed }) => ({
          height: 44,
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          paddingHorizontal: 12,
          opacity: pressed ? 0.6 : 1,
        })}
      >
        <View style={{ flex: 1 }}>{left}</View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
          <T v="small" w="600">
            {label}
          </T>
          <ArrowUpRight size={14} color={c.ink} weight="bold" />
        </View>
      </Pressable>
    </>
  );
}

/* ── 랭킹 ─────────────────────────────────────── */

function Delta({ delta, isNew }: { delta: number | null; isNew?: boolean }) {
  const c = useColors();
  if (isNew)
    return (
      <T w="700" color={c.accent} style={{ fontSize: 12, lineHeight: 18 }}>
        NEW
      </T>
    );
  if (delta === null || delta === 0) return null;
  const up = delta > 0;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
      {up ? <CaretUp size={10} color={c.up} weight="fill" /> : <CaretDown size={10} color={c.down} weight="fill" />}
      <T v="small" w="600" color={up ? c.up : c.down}>
        {String(Math.abs(delta))}
      </T>
    </View>
  );
}

/** 2위 아래는 접어 둔다. 카드의 일은 "이번 주 1위가 누구인지" 를 한눈에 알리는 것이다. */
function RankingList({ rows }: { rows: RankRow[] }) {
  const c = useColors();
  const [open, setOpen] = useState(false);
  const first = rows[0]?.rank ?? 2;
  const last = rows.at(-1)?.rank ?? first;

  const toggle = (label: string, up: boolean) => (
    <>
      <Rule />
      <Pressable
        onPress={() => setOpen(!open)}
        style={{ height: 44, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12 }}
      >
        <T v="small" w="600" c={up ? "ink3" : "ink"}>
          {label}
        </T>
        {up ? <CaretUp size={14} color={c.ink3} weight="bold" /> : <CaretDown size={14} color={c.ink3} weight="bold" />}
      </Pressable>
    </>
  );

  if (!open) return toggle(`${first}–${last}위`, false);
  return (
    <>
      {rows.map((r) => (
        <View key={`${r.rank}-${r.name}`}>
          <Rule />
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 12, paddingVertical: 8 }}>
            <T c="ink3" style={{ width: 20, textAlign: "center", fontVariant: ["tabular-nums"] }}>
              {String(r.rank)}
            </T>
            <View style={{ flex: 1 }}>
              <T numberOfLines={1}>{r.name}</T>
              {r.club ? (
                <T v="small" c="ink3" numberOfLines={1}>
                  {r.club}
                </T>
              ) : null}
            </View>
            <Delta delta={r.delta} isNew={r.isNew} />
          </View>
        </View>
      ))}
      {toggle("접기", true)}
    </>
  );
}

function Ranking({ a }: { a: Extract<A, { type: "ranking" }> }) {
  const scope = [a.org, a.region, a.division].filter(Boolean).join(" ");
  return (
    <Card>
      <Lead
        eyebrow={`${scope} · ${a.week}`}
        mark={`${a.leader.rank}위`}
        name={a.leader.name}
        sub={[a.leader.club, a.story].filter(Boolean).join(" · ") || undefined}
      />
      {a.runnersUp.length > 0 && <RankingList rows={a.runnersUp} />}
    </Card>
  );
}

/* ── 대회 결과 ────────────────────────────────── */

function PodiumRow({ label, team }: { label: string; team: PodiumTeam }) {
  return (
    <>
      <Rule />
      <View style={{ flexDirection: "row", gap: 12, paddingHorizontal: 12, paddingVertical: 8 }}>
        <T v="small" c="ink3" style={{ width: 50, paddingTop: 2 }}>
          {label}
        </T>
        <View style={{ flex: 1 }}>
          <T numberOfLines={1}>{team.names}</T>
          {team.clubs ? (
            <T v="small" c="ink3" numberOfLines={1}>
              {team.clubs}
            </T>
          ) : null}
        </View>
      </View>
    </>
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
      <OutLink
        href={a.sourceUrl}
        left={
          <T v="small" c="ink3" numberOfLines={1}>
            {a.tournament}
          </T>
        }
        label="대진표"
      />
    </Card>
  );
}

/* ── 대회 일정 ────────────────────────────────── */

const STATUS_LABEL = { open: "접수 중", upcoming: "접수 예정", closed: "접수 마감" } as const;

function Tournament({ a }: { a: Extract<A, { type: "tournament" }> }) {
  const c = useColors();
  const open = a.status === "open";
  return (
    <Card>
      <View style={{ paddingHorizontal: 12, paddingTop: 10, paddingBottom: 12 }}>
        <T w="600">{a.name}</T>
        <T v="small" c="ink3" style={{ marginTop: 2 }}>
          {[a.dateLabel, a.venue].filter(Boolean).join(" · ")}
        </T>
        {a.divisions.length > 0 && (
          <T v="small" c="ink3">
            {a.divisions.join(" · ")}
          </T>
        )}
      </View>
      <OutLink
        href={a.sourceUrl}
        left={
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            {open && <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: c.up }} />}
            <T v="small" c={open ? "ink" : "ink3"}>
              {STATUS_LABEL[a.status]}
            </T>
          </View>
        }
        label={open ? "신청하러 가기" : "대회 요강"}
      />
    </Card>
  );
}

/* ── 경기 영상 ────────────────────────────────── */

function Video({ a }: { a: Extract<A, { type: "video" }> }) {
  const c = useColors();
  const meta = [a.channel, a.duration].filter(Boolean).join(" · ");
  const tag = [a.tournament, a.division, a.round].filter(Boolean).join(" · ");
  return (
    <Card>
      {/* 재생은 유튜브에서 한다(API 약관). 유튜브 앱이 있으면 거기서 열린다. */}
      <Pressable onPress={() => void Linking.openURL(a.watchUrl)} style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}>
        <View style={{ height: 190, backgroundColor: c.grouped }}>
          {a.thumbnailUrl ? (
            <Image source={{ uri: a.thumbnailUrl }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
          ) : null}
          <View
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              width: 48,
              height: 48,
              marginLeft: -24,
              marginTop: -24,
              borderRadius: 24,
              backgroundColor: "rgba(0,0,0,0.6)",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Play size={20} color="#fff" weight="fill" />
          </View>
        </View>
        <Rule />
        <View style={{ paddingHorizontal: 12, paddingTop: 10, paddingBottom: 12 }}>
          {tag ? (
            <T v="small" c="ink3">
              {tag}
            </T>
          ) : null}
          <T w="600">{a.title}</T>
          {meta ? (
            <T v="small" c="ink3" style={{ marginTop: 2 }}>
              {meta}
            </T>
          ) : null}
        </View>
      </Pressable>
    </Card>
  );
}

/* ── 아직 수집하지 않는 종류 — 타입이 있으니 그릴 줄은 안다 ── */

const won = (n: number) => n.toLocaleString("ko-KR");

function Gear({ a }: { a: Extract<A, { type: "gear" }> }) {
  const c = useColors();
  return (
    <Card>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 12 }}>
        <View style={{ width: 48, height: 48, borderRadius: RADIUS.media, backgroundColor: c.grouped, alignItems: "center", justifyContent: "center" }}>
          <Package size={24} color={c.ink3} />
        </View>
        <View style={{ flex: 1 }}>
          <T w="600" numberOfLines={1}>
            {a.product}
          </T>
          <T v="small" c="ink3" numberOfLines={1}>
            {a.spec}
          </T>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <T w="600">{`${won(a.price)}원`}</T>
          {a.wasPrice ? (
            <T v="small" c="ink3" style={{ textDecorationLine: "line-through" }}>
              {`${won(a.wasPrice)}원`}
            </T>
          ) : null}
        </View>
      </View>
    </Card>
  );
}

const setsWon = (me: number[], other: number[]) => me.filter((g, i) => g > (other[i] ?? 0)).length;

function ScoreRow({ side, opponent }: { side: MatchSide; opponent: MatchSide }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
      <T w={side.won ? "600" : "400"} c={side.won ? "ink" : "ink3"} numberOfLines={1} style={{ flex: 1 }}>
        {side.name}
      </T>
      <T v="small" c="ink3">
        {side.sets.join("  ")}
      </T>
      <T w={side.won ? "700" : "400"} c={side.won ? "ink" : "ink3"} style={{ width: 16, textAlign: "right" }}>
        {String(setsWon(side.sets, opponent.sets))}
      </T>
    </View>
  );
}

function Score({ a }: { a: Extract<A, { type: "score" }> }) {
  return (
    <Card>
      <View style={{ paddingHorizontal: 12, paddingTop: 10, paddingBottom: 12, gap: 4 }}>
        <T v="small" c="ink3">
          {a.event}
        </T>
        <ScoreRow side={a.home} opponent={a.away} />
        <ScoreRow side={a.away} opponent={a.home} />
      </View>
    </Card>
  );
}

export function Attachment({ a }: { a: A }) {
  switch (a.type) {
    case "ranking":
      return <Ranking a={a} />;
    case "result":
      return <Result a={a} />;
    case "tournament":
      return <Tournament a={a} />;
    case "video":
      return <Video a={a} />;
    case "gear":
      return <Gear a={a} />;
    case "score":
      return <Score a={a} />;
    case "weather":
      // 카드에 담지 않는다. 숫자 셋은 글 한 줄이면 된다.
      return <T c="ink3">{`${a.temp}° · 강수 ${a.rainChance}% · 풍속 ${a.wind}`}</T>;
  }
}
