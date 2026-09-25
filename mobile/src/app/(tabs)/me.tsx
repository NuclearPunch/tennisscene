import * as WebBrowser from "expo-web-browser";
import { CaretRight } from "phosphor-react-native";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AuthGate } from "@/components/AuthGate";
import { Avatar } from "@/components/post/Avatar";
import { T } from "@/components/T";
import { Button } from "@/components/ui";
import { webUrl } from "@/lib/api";
import { useModeration } from "@/lib/moderation";
import { supabase } from "@/lib/supabase";
import { HAIR, useColors } from "@/lib/theme";
import type { Author } from "@/lib/types";

/** 프로필. 로그인은 여기서 한다 — 로그인하러 온 사람을 글쓰기 화면으로 보내지 않는다. */
export default function MeScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top }}>
      <AuthGate purpose="account">{(me) => <Profile account={me.account} />}</AuthGate>
    </View>
  );
}

function Profile({ account }: { account: Author }) {
  const c = useColors();
  // 관리자로 확인된 계정만 기억한다 — 계정을 바꿔 들어왔을 때 앞 사람의 관리자 줄이 남지 않게.
  const [adminOf, setAdminOf] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    void supabase.rpc("is_admin").then(({ data }) => alive && setAdminOf(data === true ? account.id : null));
    return () => {
      alive = false;
    };
  }, [account.id]);

  return (
    <ScrollView>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 12, paddingVertical: 16 }}>
        <Avatar author={account} size={56} />
        <View style={{ flex: 1 }}>
          <T v="lead" w="700" numberOfLines={1}>
            {account.name}
          </T>
          <T c="ink3" numberOfLines={1}>{`@${account.handle}`}</T>
        </View>
        <Button kind="line" label="로그아웃" onPress={() => void supabase.auth.signOut()} />
      </View>
      {adminOf === account.id && (
        // 관리자 화면은 웹에 있다. 운영 도구까지 앱에 넣을 이유가 없다.
        <Pressable
          onPress={() => void WebBrowser.openBrowserAsync(webUrl("/admin"))}
          style={{ height: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, borderTopWidth: HAIR, borderTopColor: c.hairline }}
        >
          <T w="600">관리자 (웹에서 열기)</T>
          <CaretRight size={16} color={c.ink3} />
        </Pressable>
      )}
      <Blocked />
      <Leave />
    </ScrollView>
  );
}

/** 차단한 계정. 글의 ··· 메뉴에서 차단하고, 여기서 푼다. */
function Blocked() {
  const c = useColors();
  const { blocked, unblock } = useModeration();
  return (
    <View style={{ borderTopWidth: HAIR, borderTopColor: c.hairline, paddingTop: 16 }}>
      <T w="600" style={{ paddingHorizontal: 12, paddingBottom: 4 }}>
        차단한 계정
      </T>
      {blocked.length === 0 ? (
        <T v="small" c="ink3" style={{ paddingHorizontal: 12, paddingBottom: 16 }}>
          없습니다. 글의 ··· 메뉴에서 차단하면 그 사람의 글과 댓글이 내 화면에서 사라집니다.
        </T>
      ) : (
        blocked.map((b) => (
          <View key={b.handle} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 12, paddingVertical: 8 }}>
            <View style={{ flex: 1 }}>
              <T numberOfLines={1}>{b.name}</T>
              <T v="small" c="ink3" numberOfLines={1}>{`@${b.handle}`}</T>
            </View>
            <Button kind="line" label="차단 해제" onPress={() => void unblock(b.handle)} />
          </View>
        ))
      )}
    </View>
  );
}

/**
 * 탈퇴 — 앱 안에서 바로(애플 5.1.1(v)). 되돌릴 수 없으니 지워지는 것을 먼저 보여주고 한 번 더 누르게 한다.
 * 지우는 일은 DB 함수(delete_my_account)가 한다 — 로그인 정보까지.
 */
function Leave() {
  const c = useColors();
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function leave() {
    setBusy(true);
    setError(null);
    const { error } = await supabase.rpc("delete_my_account");
    if (error) {
      setBusy(false);
      return setError("탈퇴하지 못했습니다. 잠시 뒤 다시 시도해주세요");
    }
    // 로그인 정보가 지워졌으니 이 기기의 세션도 버린다. 화면은 로그인 문으로 돌아간다.
    await supabase.auth.signOut().catch(() => {});
  }

  return (
    <View style={{ borderTopWidth: HAIR, borderTopColor: c.hairline, padding: 12, paddingBottom: 120 }}>
      {!asking ? (
        <Pressable onPress={() => setAsking(true)} hitSlop={8} style={{ alignSelf: "flex-start" }}>
          <T c="down">탈퇴하기</T>
        </Pressable>
      ) : (
        <View style={{ gap: 4 }}>
          <T w="600">정말 탈퇴할까요?</T>
          {[
            "로그인 정보(이메일·비밀번호)가 지워집니다",
            "쓴 글과 댓글이 모두 내려갑니다",
            "좋아요·리포스트·차단 목록이 지워집니다",
            "되돌릴 수 없습니다. 같은 이메일로 다시 가입할 수는 있습니다",
          ].map((line) => (
            <T key={line} c="ink3">{`· ${line}`}</T>
          ))}
          {error ? (
            <T v="small" c="down">
              {error}
            </T>
          ) : null}
          <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
            <View style={{ flex: 1 }}>
              <Button big kind="line" label="취소" onPress={() => setAsking(false)} />
            </View>
            <View style={{ flex: 1 }}>
              <Button big label="탈퇴" busy={busy} onPress={() => void leave()} />
            </View>
          </View>
        </View>
      )}
    </View>
  );
}
