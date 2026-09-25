import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import { useEffect } from "react";
import { Platform } from "react-native";
import { supabase } from "./supabase";

/**
 * 푸시 알림 받기 — 내 글에 댓글, 월요일 주간 랭킹 발표. 보내는 쪽은 웹 서버다(src/lib/push.ts).
 *
 * **권한은 로그인한 뒤 한 번만 묻는다.** 앱을 켜자마자 묻는 건 애플이 권하지 않는다 —
 * 무엇을 알려줄지 모르는 상태에서 물으면 대부분 거절한다.
 * **로그아웃·탈퇴할 때 이 기기를 해제한다**(signOut). 같은 폰으로 다른 사람이 로그인했을 때
 * 앞사람 알림이 가면 안 된다.
 *
 * Expo Go(안드로이드)는 원격 알림을 지원하지 않는다(SDK 53~). 거기서는 조용히 넘어간다.
 */

// 앱을 보고 있을 때 온 알림도 위에 띄운다.
if (Platform.OS !== "web") {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: false,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

const ASKED = "tennisscene.push-asked";
let current: string | null = null;

const projectId = (): string | undefined =>
  (Constants.expoConfig?.extra?.eas?.projectId as string | undefined) ?? Constants.easConfig?.projectId;

export type PushState = "unsupported" | "undetermined" | "denied" | "granted";

export async function pushState(): Promise<PushState> {
  if (Platform.OS === "web" || !Device.isDevice) return "unsupported";
  const { status } = await Notifications.getPermissionsAsync();
  return status === "granted" ? "granted" : status === "denied" ? "denied" : "undetermined";
}

/**
 * 이 기기를 알림 받을 곳으로 등록한다. `ask` 가 true 면 아직 안 물어봤을 때 권한을 묻는다.
 * 실패해도 앱은 멀쩡해야 한다 — 알림은 덤이다.
 */
export async function registerPush({ ask }: { ask: boolean }): Promise<PushState> {
  try {
    if (Platform.OS === "web" || !Device.isDevice) return "unsupported";
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "알림",
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== "granted" && ask && status === "undetermined") {
      localStorage.setItem(ASKED, "1");
      status = (await Notifications.requestPermissionsAsync()).status;
    }
    if (status !== "granted") return status === "denied" ? "denied" : "undetermined";

    const id = projectId();
    if (!id) return "unsupported";
    const token = (await Notifications.getExpoPushTokenAsync({ projectId: id })).data;
    await supabase.rpc("register_push_token", { t: token, p: Platform.OS });
    current = token;
    return "granted";
  } catch {
    // Expo Go(안드로이드) 등 원격 알림을 못 받는 환경
    return "unsupported";
  }
}

/** 로그인한 뒤 처음 한 번만 권한을 물어도 되는가 */
export const shouldAskOnce = () => localStorage.getItem(ASKED) !== "1";

/** 로그아웃·탈퇴. 이 기기의 알림을 먼저 해제하고 세션을 버린다 — 순서가 바뀌면 해제할 권한이 없다. */
export async function signOut(): Promise<void> {
  if (current) {
    await supabase.rpc("unregister_push_token", { t: current }).then(
      () => undefined,
      () => undefined,
    );
    current = null;
  }
  await supabase.auth.signOut().catch(() => {});
}

/** 알림을 누르면 그 화면으로 간다. 앱이 꺼져 있다가 알림으로 켜진 경우도 받는다. */
export function useNotificationRouting() {
  useEffect(() => {
    if (Platform.OS === "web") return;
    const go = (n: Notifications.Notification) => {
      const url = n.request.content.data?.url;
      if (typeof url === "string" && url.startsWith("/")) router.push(url as never);
    };
    const last = Notifications.getLastNotificationResponse();
    if (last?.notification) go(last.notification);
    const sub = Notifications.addNotificationResponseReceivedListener((r) => go(r.notification));
    return () => sub.remove();
  }, []);
}
