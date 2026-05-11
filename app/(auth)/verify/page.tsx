"use client";

import React, { Suspense, useEffect } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { useRouter, useSearchParams } from "next/navigation";

// Handles the PKCE/implicit flow for magic links when Supabase redirects
// to /verify with tokens in the URL fragment (#access_token=...).
// The Supabase JS client picks up the fragment automatically on init.
function VerifyInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/calculator";

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    // Listen for SIGNED_IN which fires when the client processes the fragment tokens
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if ((event === "SIGNED_IN" || event === "TOKEN_REFRESHED") && session) {
        // Sync user row
        try {
          const sessionId = sessionStorage.getItem("lh_session_id") ?? undefined;
          await fetch("/api/v1/auth/sync-user", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ session_id: sessionId }),
          });
        } catch { /* ignore */ }

        router.replace(next);
      }
    });

    return () => subscription.unsubscribe();
  }, [supabase, router, next]);

  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  if (error) {
    return (
      <div className="flex flex-col items-center text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-50">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </div>
        <h1 className="mb-2 font-serif text-xl font-semibold">链接已失效</h1>
        <p className="mb-6 text-sm font-light text-gray-500">
          {errorDescription ?? "魔术链接已过期或无效，请重新登录。"}
        </p>
        <a href="/login" className="text-sm text-[#2F4F3D] underline">
          返回登录
        </a>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center text-center">
      <div className="relative mb-6 h-14 w-14">
        <div className="absolute inset-0 rounded-full border border-[#E5E5E5]" />
        <div className="absolute inset-0 animate-spin rounded-full border border-[#2F4F3D] border-t-transparent" />
      </div>
      <h1 className="mb-2 font-serif text-xl font-semibold">正在验证身份</h1>
      <p className="text-sm font-light text-gray-500">请稍候，即将为您完成登录…</p>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense fallback={
      <div className="flex flex-col items-center text-center">
        <div className="relative mb-6 h-14 w-14">
          <div className="absolute inset-0 rounded-full border border-[#E5E5E5]" />
          <div className="absolute inset-0 animate-spin rounded-full border border-[#2F4F3D] border-t-transparent" />
        </div>
        <h1 className="mb-2 font-serif text-xl font-semibold">正在验证身份</h1>
        <p className="text-sm font-light text-gray-500">请稍候，即将为您完成登录…</p>
      </div>
    }>
      <VerifyInner />
    </Suspense>
  );
}
