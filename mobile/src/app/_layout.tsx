import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { useColorScheme } from "react-native";
import { MeProvider, useMe } from "@/lib/me";
import { ModerationProvider } from "@/lib/moderation";
import { registerPush, shouldAskOnce, useNotificationRouting } from "@/lib/push";
import { ReactionProvider, useReactions } from "@/lib/reactions";
import { useColors } from "@/lib/theme";

SplashScreen.preventAutoHideAsync().catch(() => {});

/**
 * 로그인하면 이 기기를 알림 받을 곳으로 등록한다. 권한은 처음 한 번만 묻는다.
 * 이미 허락한 기기는 켤 때마다 다시 등록한다 — 토큰이 바뀌었을 수 있다.
 */
function PushRegistrar() {
  const { me } = useMe();
  const accountId = me.status === "ready" ? me.account.id : null;
  useEffect(() => {
    if (accountId) void registerPush({ ask: shouldAskOnce() });
  }, [accountId]);
  useNotificationRouting();
  return null;
}

/** 로그아웃하면 앞 사람의 하트를 지운다. */
function ForgetOnSignOut() {
  const { me } = useMe();
  const { reset } = useReactions();
  useEffect(() => {
    if (me.status === "guest") reset();
  }, [me.status, reset]);
  return null;
}

export default function RootLayout() {
  const scheme = useColorScheme();
  const c = useColors();
  const base = scheme === "dark" ? DarkTheme : DefaultTheme;

  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  return (
    <ThemeProvider
      value={{
        ...base,
        colors: {
          ...base.colors,
          background: c.bg,
          card: c.bg,
          text: c.ink,
          border: c.hairline,
          primary: c.ink,
        },
      }}
    >
      <MeProvider>
        <ReactionProvider>
          <ModerationProvider>
            <ForgetOnSignOut />
          <PushRegistrar />
            <StatusBar style="auto" />
            <Stack
              screenOptions={{
                headerShadowVisible: false,
                headerTintColor: c.ink,
                headerStyle: { backgroundColor: c.bg },
                contentStyle: { backgroundColor: c.bg },
                headerBackButtonDisplayMode: "minimal",
              }}
            >
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="p/[id]" options={{ title: "스레드" }} />
            </Stack>
          </ModerationProvider>
        </ReactionProvider>
      </MeProvider>
    </ThemeProvider>
  );
}
