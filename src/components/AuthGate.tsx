"use client";

import { useEffect, useState } from "react";
import { Logo } from "@/components/Logo";
import { Reply } from "@/components/icons";
import type { Me } from "@/lib/me";
import { browserClient } from "@/lib/supabase-browser";

/**
 * 쓰려고 할 때만 나오는 문. 읽기에는 로그인이 필요 없다.
 *
 *   guest          → 로그인 / 가입
 *   needs-profile  → 닉네임과 아이디 한 번
 *   ready          → children
 */

const FIELD =
  "h-12 w-full rounded-card bg-grouped px-4 outline-none placeholder:text-ink-3";
const PRIMARY =
  "h-12 w-full cursor-pointer rounded-card bg-ink font-semibold text-bg disabled:cursor-default disabled:opacity-30";

function Shell({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-[360px] grow flex-col justify-center gap-6 px-6 pb-24">
      <div className="flex flex-col items-center gap-4 text-center">
        <Logo height={28} />
        <div>
          <p className="text-[20px] leading-[26px] font-bold tracking-[-0.01em]">{title}</p>
          {note && <p className="mt-1 text-ink-3">{note}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}

/** Supabase 의 영어 오류를 그대로 보여주지 않는다. */
function authMessage(raw: string): string {
  if (/invalid login credentials/i.test(raw)) return "이메일이나 비밀번호가 맞지 않습니다";
  if (/email not confirmed/i.test(raw)) return "메일로 보낸 확인 링크를 먼저 눌러주세요";
  if (/already registered/i.test(raw)) return "이미 가입된 이메일입니다. 로그인해주세요";
  if (/at least 6/i.test(raw)) return "비밀번호는 6자 이상이어야 합니다";
  if (/rate limit|too many/i.test(raw)) return "요청이 많습니다. 잠시 뒤 다시 시도해주세요";
  if (/invalid.*email|email.*invalid/i.test(raw)) return "이메일 주소를 확인해주세요";
  return "문제가 생겼습니다. 잠시 뒤 다시 시도해주세요";
}

function Login() {
  const [mode, setMode] = useState<"login" | "signup" | "sent">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // 카카오는 Supabase 대시보드에서 켜는 순간 버튼이 나타난다. 꺼져 있는 버튼을 보여주지 않는다.
  const [kakao, setKakao] = useState(false);

  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) return;
    fetch(`${url}/auth/v1/settings`, { headers: { apikey: key } })
      .then((r) => r.json())
      .then((s) => setKakao(s?.external?.kakao === true))
      .catch(() => {});
  }, []);

  const here = () => `${window.location.origin}${window.location.pathname}`;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const auth = browserClient().auth;

    const { data, error } =
      mode === "signup"
        ? await auth.signUp({ email, password, options: { emailRedirectTo: here() } })
        : await auth.signInWithPassword({ email, password });

    setBusy(false);
    if (error) return setError(authMessage(error.message));
    // 메일 확인이 켜져 있으면 가입 직후에는 세션이 없다.
    if (mode === "signup" && !data.session) setMode("sent");
  }

  if (mode === "sent") {
    return (
      <Shell title="메일을 확인해주세요" note={`${email} 로 확인 링크를 보냈습니다. 링크를 누른 뒤 여기로 돌아와 로그인하면 됩니다.`}>
        <button type="button" className={PRIMARY} onClick={() => setMode("login")}>
          로그인하러 가기
        </button>
      </Shell>
    );
  }

  const signup = mode === "signup";
  return (
    <Shell
      title={signup ? "테니스씬 시작하기" : "로그인하고 글쓰기"}
      note="읽는 건 누구나, 쓰는 건 로그인한 사람만."
    >
      {kakao && (
        <>
          <button
            type="button"
            onClick={() =>
              void browserClient().auth.signInWithOAuth({
                provider: "kakao",
                options: { redirectTo: here() },
              })
            }
            className="flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-card bg-[#FEE500] font-semibold text-black/85"
          >
            <Reply className="h-5 w-5" />
            카카오로 계속하기
          </button>
          <div className="flex items-center gap-3 text-[13px] leading-[18px] text-ink-3">
            <span className="hair-t grow" />
            또는
            <span className="hair-t grow" />
          </div>
        </>
      )}

      <form onSubmit={submit} className="flex flex-col gap-2">
        <input
          type="email"
          required
          autoComplete="email"
          placeholder="이메일"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={FIELD}
        />
        <input
          type="password"
          required
          minLength={6}
          autoComplete={signup ? "new-password" : "current-password"}
          placeholder={signup ? "비밀번호 (6자 이상)" : "비밀번호"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={FIELD}
        />
        {error && (
          <p role="alert" className="px-1 text-[13px] leading-[18px] text-down">
            {error}
          </p>
        )}
        <button type="submit" disabled={busy || !email || !password} className={`mt-1 ${PRIMARY}`}>
          {busy ? "잠시만요" : signup ? "가입하기" : "로그인"}
        </button>
      </form>

      <button
        type="button"
        onClick={() => {
          setMode(signup ? "login" : "signup");
          setError(null);
        }}
        className="cursor-pointer text-ink-3"
      >
        {signup ? "이미 계정이 있어요" : "처음이에요 — 가입하기"}
      </button>
    </Shell>
  );
}

const HANDLE = /^[a-z0-9_]{2,20}$/;

function Profile({ userId, onDone }: { userId: string; onDone: () => Promise<void> }) {
  const [name, setName] = useState("");
  const [handle, setHandle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cleanName = name.trim();
  const valid = cleanName.length >= 1 && cleanName.length <= 40 && HANDLE.test(handle);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    // id 는 DB 기본값('u_' + uuid)에 맡긴다. kind 와 auth_user_id 는 RLS 가 본인 것만 받는다.
    const { error } = await browserClient().from("accounts").insert({
      auth_user_id: userId,
      kind: "user",
      handle,
      name: cleanName,
      initial: Array.from(cleanName)[0],
    });

    if (error) {
      setBusy(false);
      return setError(
        error.code === "23505"
          ? "이미 누가 쓰고 있는 아이디입니다"
          : "프로필을 만들지 못했습니다. 잠시 뒤 다시 시도해주세요",
      );
    }
    await onDone();
  }

  return (
    <Shell title="프로필 만들기" note="피드에 이 이름으로 올라갑니다. 익명 글은 글마다 따로 고를 수 있어요.">
      <form onSubmit={submit} className="flex flex-col gap-2">
        <input
          required
          maxLength={40}
          placeholder="닉네임"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={FIELD}
        />
        <label className={`flex items-center gap-0.5 ${FIELD}`}>
          <span className="text-ink-3">@</span>
          <input
            required
            maxLength={20}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            placeholder="아이디"
            value={handle}
            // 대문자를 받아주면 대소문자만 다른 아이디로 사칭할 수 있다. 입력부터 소문자로.
            onChange={(e) => setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
            className="min-w-0 grow bg-transparent outline-none placeholder:text-ink-3"
          />
        </label>
        <p className="px-1 text-[13px] leading-[18px] text-ink-3">
          아이디는 영문 소문자·숫자·밑줄 2–20자
        </p>
        {error && (
          <p role="alert" className="px-1 text-[13px] leading-[18px] text-down">
            {error}
          </p>
        )}
        <button type="submit" disabled={busy || !valid} className={`mt-1 ${PRIMARY}`}>
          {busy ? "잠시만요" : "시작하기"}
        </button>
      </form>
    </Shell>
  );
}

export function AuthGate({
  me,
  refresh,
  children,
}: {
  me: Me;
  refresh: () => Promise<void>;
  children: React.ReactNode;
}) {
  if (me.status === "loading") return <div className="grow" />;
  if (me.status === "guest") return <Login />;
  if (me.status === "needs-profile") {
    return <Profile userId={me.session.user.id} onDone={refresh} />;
  }
  return <>{children}</>;
}
