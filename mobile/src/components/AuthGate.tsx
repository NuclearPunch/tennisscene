import * as WebBrowser from "expo-web-browser";
import { CheckSquare, Square } from "phosphor-react-native";
import { useState } from "react";
import { KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, View } from "react-native";
import { Logo } from "@/components/brand/Logo";
import { T } from "@/components/T";
import { Button, Field } from "@/components/ui";
import { webUrl } from "@/lib/api";
import { CONTACT_EMAIL } from "@/lib/config";
import { type Me, useMe } from "@/lib/me";
import { supabase } from "@/lib/supabase";
import { useColors } from "@/lib/theme";

/**
 * 쓰려고 할 때만 나오는 문. 읽기에는 로그인이 없다. 웹의 AuthGate 와 같은 흐름이다.
 *
 *   guest          → 로그인 / 가입
 *   needs-profile  → 닉네임과 아이디 한 번
 *   error          → 계정을 확인하지 못함. 다시 시도 (닉네임 화면을 띄우지 않는다)
 *   ready          → children
 */
export type GatePurpose = "write" | "account";

function Shell({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: 24, gap: 24 }} keyboardShouldPersistTaps="handled">
        <View style={{ alignItems: "center", gap: 16 }}>
          <Logo height={28} />
          <View style={{ alignItems: "center" }}>
            <T v="lead" w="700">
              {title}
            </T>
            {note ? (
              <T c="ink3" style={{ marginTop: 4, textAlign: "center" }}>
                {note}
              </T>
            ) : null}
          </View>
        </View>
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/** Supabase 의 영어 오류를 그대로 보여주지 않는다(웹과 같은 문구). */
function authMessage(raw: string): string {
  if (/invalid login credentials/i.test(raw)) return "이메일이나 비밀번호가 맞지 않습니다";
  if (/email not confirmed/i.test(raw)) return "메일로 보낸 확인 링크를 먼저 눌러주세요";
  if (/already registered/i.test(raw)) return "이미 가입된 이메일입니다. 로그인해주세요";
  if (/at least 6/i.test(raw)) return "비밀번호는 6자 이상이어야 합니다";
  if (/rate limit|too many/i.test(raw)) return "요청이 많습니다. 잠시 뒤 다시 시도해주세요";
  if (/invalid.*email|email.*invalid/i.test(raw)) return "이메일 주소를 확인해주세요";
  return "문제가 생겼습니다. 잠시 뒤 다시 시도해주세요";
}

function Login({ purpose }: { purpose: GatePurpose }) {
  const [mode, setMode] = useState<"login" | "signup" | "sent">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // 가입은 약관·방침 동의와 만 14세 이상 확인이 있어야 된다(애플 1.2, 개인정보보호법 제22조의2).
  const [agreed, setAgreed] = useState(false);
  const [adult, setAdult] = useState(false);

  async function submit() {
    setBusy(true);
    setError(null);
    const { data, error } =
      mode === "signup"
        ? // 확인 메일의 링크는 웹으로 간다. 누르고 앱으로 돌아와 로그인하면 된다.
          await supabase.auth.signUp({ email, password, options: { emailRedirectTo: webUrl("/me") } })
        : await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) return setError(authMessage(error.message));
    if (mode === "signup" && !data.session) setMode("sent");
  }

  if (mode === "sent") {
    return (
      <Shell title="메일을 확인해주세요" note={`${email} 로 확인 링크를 보냈습니다. 링크를 누른 뒤 앱으로 돌아와 로그인하면 됩니다.`}>
        <Button big label="로그인하러 가기" onPress={() => setMode("login")} />
      </Shell>
    );
  }

  const signup = mode === "signup";
  return (
    <Shell
      title={signup ? "테니스씬 시작하기" : purpose === "write" ? "로그인하고 글쓰기" : "로그인"}
      note="읽는 건 누구나, 쓰는 건 로그인한 사람만."
    >
      <View style={{ gap: 8 }}>
        <Field
          placeholder="이메일"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          textContentType="emailAddress"
        />
        <Field
          placeholder={signup ? "비밀번호 (6자 이상)" : "비밀번호"}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete={signup ? "new-password" : "current-password"}
          textContentType={signup ? "newPassword" : "password"}
          onSubmitEditing={() => email && password && void submit()}
        />
        {error ? (
          <T v="small" c="down" style={{ paddingHorizontal: 4 }}>
            {error}
          </T>
        ) : null}
        {signup && (
          <View style={{ gap: 6, marginTop: 4, paddingHorizontal: 4 }}>
            <Check checked={agreed} onChange={setAgreed}>
              <T v="small" c="ink2">
                <T v="small" c="ink2" style={{ textDecorationLine: "underline" }} onPress={() => void WebBrowser.openBrowserAsync(webUrl("/terms"))}>
                  이용약관
                </T>
                과{" "}
                <T v="small" c="ink2" style={{ textDecorationLine: "underline" }} onPress={() => void WebBrowser.openBrowserAsync(webUrl("/privacy"))}>
                  개인정보 처리방침
                </T>
                에 동의합니다 (필수)
              </T>
            </Check>
            <Check checked={adult} onChange={setAdult}>
              <T v="small" c="ink2">
                만 14세 이상입니다 (필수)
              </T>
            </Check>
          </View>
        )}
        <View style={{ marginTop: 4 }}>
          <Button
            big
            label={signup ? "가입하기" : "로그인"}
            onPress={() => void submit()}
            busy={busy}
            disabled={!email || !password || (signup && !(agreed && adult))}
          />
        </View>
      </View>
      <Pressable
        onPress={() => {
          setMode(signup ? "login" : "signup");
          setError(null);
        }}
        style={{ alignSelf: "center", padding: 8 }}
      >
        <T c="ink3">{signup ? "이미 계정이 있어요" : "처음이에요 — 가입하기"}</T>
      </Pressable>
      <LegalLinks />
    </Shell>
  );
}

function Check({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode }) {
  const c = useColors();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      onPress={() => onChange(!checked)}
      style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}
    >
      {checked ? <CheckSquare size={18} color={c.ink} weight="fill" /> : <Square size={18} color={c.ink3} />}
      <View style={{ flex: 1 }}>{children}</View>
    </Pressable>
  );
}

/** 약관·방침·문의. 로그인 문 아래와 프로필에 둔다 — 애플은 앱 안에서 쉽게 찾을 수 있어야 한다고 한다. */
export function LegalLinks() {
  const link = { textDecorationLine: "underline" } as const;
  return (
    <T v="small" c="ink3" style={{ textAlign: "center" }}>
      <T v="small" c="ink3" style={link} onPress={() => void WebBrowser.openBrowserAsync(webUrl("/terms"))}>
        이용약관
      </T>
      {" · "}
      <T v="small" c="ink3" style={link} onPress={() => void WebBrowser.openBrowserAsync(webUrl("/privacy"))}>
        개인정보 처리방침
      </T>
      {" · "}
      <T v="small" c="ink3" style={link} onPress={() => void Linking.openURL(`mailto:${CONTACT_EMAIL}`)}>
        문의
      </T>
    </T>
  );
}

const HANDLE = /^[a-z0-9_]{2,20}$/;

function Profile({ userId, onDone }: { userId: string; onDone: () => Promise<void> }) {
  const [name, setName] = useState("");
  const [handle, setHandle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const clean = name.trim();
  const valid = clean.length >= 1 && clean.length <= 40 && HANDLE.test(handle);

  async function submit() {
    setBusy(true);
    setError(null);
    // id 는 DB 기본값에 맡긴다. kind 와 auth_user_id 는 RLS 가 본인 것만 받는다.
    const { error } = await supabase.from("accounts").insert({
      auth_user_id: userId,
      kind: "user",
      handle,
      name: clean,
      initial: Array.from(clean)[0],
    });
    if (error) {
      setBusy(false);
      return setError(error.code === "23505" ? "이미 누가 쓰고 있는 아이디입니다" : "프로필을 만들지 못했습니다. 잠시 뒤 다시 시도해주세요");
    }
    await onDone();
  }

  return (
    <Shell title="프로필 만들기" note="피드에 이 이름으로 올라갑니다. 익명 글은 글마다 따로 고를 수 있어요.">
      <View style={{ gap: 8 }}>
        <Field placeholder="닉네임" value={name} onChangeText={setName} maxLength={40} />
        <Field
          placeholder="아이디 (영문 소문자·숫자·밑줄 2–20자)"
          value={handle}
          // 대문자를 받아주면 대소문자만 다른 아이디로 사칭할 수 있다. 입력부터 소문자로.
          onChangeText={(v) => setHandle(v.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={20}
        />
        {error ? (
          <T v="small" c="down" style={{ paddingHorizontal: 4 }}>
            {error}
          </T>
        ) : null}
        <View style={{ marginTop: 4 }}>
          <Button big label="시작하기" onPress={() => void submit()} busy={busy} disabled={!valid} />
        </View>
      </View>
    </Shell>
  );
}

/** 로그인은 됐는데 계정을 못 읽었다. 닉네임을 새로 받으면 안 된다 — 이미 있을 수 있다. */
function Retry({ refresh }: { refresh: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  return (
    <Shell title="계정을 확인하지 못했습니다" note="잠시 뒤 다시 시도해주세요.">
      <Button
        big
        label="다시 시도"
        busy={busy}
        onPress={async () => {
          setBusy(true);
          await refresh();
          setBusy(false);
        }}
      />
      <Pressable onPress={() => void supabase.auth.signOut()} style={{ alignSelf: "center", padding: 8 }}>
        <T c="ink3">로그아웃</T>
      </Pressable>
    </Shell>
  );
}

export function AuthGate({ purpose = "write", children }: { purpose?: GatePurpose; children: (me: Extract<Me, { status: "ready" }>) => React.ReactNode }) {
  const { me, refresh } = useMe();
  if (me.status === "loading") return <View style={{ flex: 1 }} />;
  if (me.status === "guest") return <Login purpose={purpose} />;
  if (me.status === "error") return <Retry refresh={refresh} />;
  if (me.status === "needs-profile") return <Profile userId={me.session.user.id} onDone={refresh} />;
  return <>{children(me)}</>;
}
