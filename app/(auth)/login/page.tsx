"use client";

import React, { useState, useEffect } from "react";
import { createBrowserClient } from "@supabase/ssr";

type Mode = "phone" | "email";
type Step = "input" | "otp";

function PrimaryBtn({
  children,
  onClick,
  disabled,
  loading,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className="flex min-h-14 w-full items-center justify-center gap-2 rounded-[4px] bg-[#2F4F3D] px-6 py-4 text-base font-medium text-white transition-colors hover:bg-[#2F4F3D]/90 disabled:opacity-50"
    >
      {loading ? (
        <span className="h-5 w-5 animate-spin rounded-full border border-white border-t-transparent" />
      ) : (
        children
      )}
    </button>
  );
}

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>("phone");
  const [step, setStep] = useState<Step>("input");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  async function handleSend() {
    setError(null);
    setLoading(true);

    const body =
      mode === "phone" ? { phone: phone.startsWith("+") ? phone : `+65${phone}` } : { email };

    try {
      const res = await fetch("/api/v1/auth/otp-send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();

      if (json.ok) {
        if (mode === "phone") {
          setStep("otp");
          setCountdown(60);
        } else {
          setSuccessMsg("魔术链接已发送到您的邮箱，请查收并点击链接登录。");
        }
      } else {
        const retryAfter = json.error?.retryAfter;
        if (retryAfter) setCountdown(retryAfter);
        setError(json.error?.message ?? "发送失败，请重试");
      }
    } catch {
      setError("网络错误，请检查连接后重试");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp() {
    setError(null);
    setLoading(true);

    const fullPhone = phone.startsWith("+") ? phone : `+65${phone}`;

    const { data, error: verifyErr } = await supabase.auth.verifyOtp({
      phone: fullPhone,
      token: otp.trim(),
      type: "sms",
    });

    if (verifyErr || !data.session) {
      setError(verifyErr?.message ?? "OTP 错误，请重新输入");
      setLoading(false);
      return;
    }

    // Sync user row and associate session data
    const sessionId = (() => {
      try {
        return sessionStorage.getItem("lh_session_id") ?? undefined;
      } catch {
        return undefined;
      }
    })();
    const utmSource = (() => {
      try {
        const p = new URLSearchParams(window.location.search);
        return p.get("utm_source") ?? undefined;
      } catch {
        return undefined;
      }
    })();

    await fetch("/api/v1/auth/sync-user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: sessionId, utm_source: utmSource }),
    });

    // Redirect to calculator or next param
    const next = new URLSearchParams(window.location.search).get("next") ?? "/calculator";
    window.location.href = next;
  }

  // ─── Success state (email magic link sent) ──────────────────────────────
  if (successMsg) {
    return (
      <div className="flex flex-col items-center text-center">
        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-[#EAEFEB]">
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            <path
              d="M6 14L11 19L22 9"
              stroke="#2F4F3D"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <h1 className="mb-3 font-serif text-2xl font-semibold">邮件已发送</h1>
        <p className="mb-6 text-sm leading-relaxed font-light text-gray-500">{successMsg}</p>
        <button
          onClick={() => {
            setSuccessMsg(null);
            setStep("input");
            setEmail("");
          }}
          className="text-sm text-[#2F4F3D] underline"
        >
          返回重新发送
        </button>
      </div>
    );
  }

  // ─── OTP verification step ─────────────────────────────────────────────
  if (step === "otp") {
    return (
      <div>
        {/* Header */}
        <div className="mb-8 flex items-center gap-4">
          <button
            onClick={() => {
              setStep("input");
              setOtp("");
              setError(null);
            }}
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border border-[#E5E5E5]"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path
                d="M12.5 15L7.5 10L12.5 5"
                stroke="#1A1C1A"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <div>
            <h1 className="font-serif text-2xl font-semibold">输入验证码</h1>
            <p className="mt-1 text-sm font-light text-gray-500">
              已发送 6 位验证码至 +65&nbsp;{phone}
            </p>
          </div>
        </div>

        <div className="space-y-6">
          <div>
            <label className="mb-3 block text-xs font-medium tracking-[0.2em] text-gray-500 uppercase">
              验证码
            </label>
            <input
              type="tel"
              inputMode="numeric"
              maxLength={6}
              value={otp}
              onChange={(e) => {
                setOtp(e.target.value.replace(/\D/g, ""));
                setError(null);
              }}
              placeholder="000000"
              className="w-full border-b border-[#E5E5E5] py-3 text-center font-serif text-2xl tracking-[0.3em] transition-colors focus:border-[#2F4F3D] focus:outline-none"
            />
            {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
          </div>

          <PrimaryBtn onClick={handleVerifyOtp} disabled={otp.length < 6} loading={loading}>
            验证并登录
          </PrimaryBtn>

          {/* Resend */}
          <div className="text-center text-sm text-gray-500">
            {countdown > 0 ? (
              <span>
                重新发送（<span className="tabular-nums">{countdown}</span>s）
              </span>
            ) : (
              <button
                onClick={() => {
                  setOtp("");
                  handleSend();
                }}
                className="text-[#2F4F3D] underline"
              >
                重新发送验证码
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ─── Input step ────────────────────────────────────────────────────────
  return (
    <div>
      {/* Brand */}
      <div className="mb-8 flex items-center gap-2">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path
            d="M12 3L20 8V19C20 19.6 19.6 20 19 20H5C4.4 20 4 19.6 4 19V8Z"
            stroke="#2F4F3D"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <path d="M8 20V13H16V20" stroke="#2F4F3D" strokeWidth="1.5" />
        </svg>
        <span className="text-sm font-medium tracking-wide text-[#1A1C1A]">狮城家 LionHome</span>
      </div>

      <h1 className="mb-2 font-serif text-2xl font-semibold">登录 / 注册</h1>
      <p className="mb-7 text-sm leading-relaxed font-light text-gray-500">
        无需密码，手机号或邮箱即可安全登录。
      </p>

      {/* Mode toggle */}
      <div className="mb-7 flex gap-1 rounded-[4px] bg-gray-100 p-1">
        {(["phone", "email"] as Mode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => {
              setMode(m);
              setError(null);
            }}
            className={`flex min-h-[44px] flex-1 items-center justify-center rounded-[4px] text-sm font-medium transition-all ${
              mode === m
                ? "bg-white text-[#2F4F3D] shadow-sm"
                : "text-gray-500 hover:text-[#1A1C1A]"
            }`}
          >
            {m === "phone" ? "手机号 OTP" : "邮箱魔术链接"}
          </button>
        ))}
      </div>

      <div className="space-y-6">
        {mode === "phone" ? (
          <div>
            <label className="mb-3 block text-xs font-medium tracking-[0.2em] text-gray-500 uppercase">
              新加坡手机号
            </label>
            <div className="flex items-center border-b border-[#E5E5E5] transition-colors focus-within:border-[#2F4F3D]">
              <span className="py-3 pr-2 text-base text-gray-500">+65</span>
              <input
                type="tel"
                inputMode="tel"
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value.replace(/\D/g, ""));
                  setError(null);
                }}
                placeholder="8123 4567"
                maxLength={8}
                className="flex-1 py-3 font-sans text-base focus:outline-none"
              />
            </div>
            {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
          </div>
        ) : (
          <div>
            <label className="mb-3 block text-xs font-medium tracking-[0.2em] text-gray-500 uppercase">
              电子邮箱
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError(null);
              }}
              placeholder="you@example.com"
              className="w-full border-b border-[#E5E5E5] py-3 font-sans text-base transition-colors focus:border-[#2F4F3D] focus:outline-none"
            />
            {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
          </div>
        )}

        <PrimaryBtn
          onClick={handleSend}
          disabled={mode === "phone" ? phone.length < 8 : !email.includes("@")}
          loading={loading}
        >
          {mode === "phone" ? "发送验证码" : "发送魔术链接"}
        </PrimaryBtn>

        <p className="text-center text-[11px] leading-relaxed font-light text-gray-400">
          登录即表示您同意我们的{" "}
          <a href="/privacy" className="text-[#2F4F3D] underline">
            隐私政策
          </a>{" "}
          与{" "}
          <a href="/terms" className="text-[#2F4F3D] underline">
            使用条款
          </a>
          。
        </p>
      </div>
    </div>
  );
}
