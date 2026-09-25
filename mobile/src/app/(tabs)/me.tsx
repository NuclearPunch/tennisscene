import * as WebBrowser from "expo-web-browser";
import { CaretRight } from "phosphor-react-native";
import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AuthGate } from "@/components/AuthGate";
import { Avatar } from "@/components/post/Avatar";
import { T } from "@/components/T";
import { Button } from "@/components/ui";
import { webUrl } from "@/lib/api";
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
    <View>
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
    </View>
  );
}
