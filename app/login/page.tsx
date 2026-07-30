"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AuroraBackground } from "@/components/ui/aurora-background";
import { BorderBeam } from "@/components/ui/border-beam";
import { LilyMark } from "@/components/Logo";

const GREETINGS = [
  "Good morning.",
  "Welcome back.",
  "Ready to roll.",
  "Hey there.",
  "Let's get to work.",
  "Back at it.",
  "Orders are waiting.",
  "Your desk is clear.",
];

// Pick one greeting per session load — doesn't cycle
const GREETING = GREETINGS[Math.floor(Math.random() * GREETINGS.length)];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setBusy(false);
        setError(data?.error || "Couldn't sign you in — please try again.");
        return;
      }
      // Only ever return to a path on this site. Redirecting to a raw `from`
      // value would let a crafted link (?from=https://evil.example) bounce a
      // just-authenticated user off-site — a classic open redirect.
      const raw = new URLSearchParams(window.location.search).get("from") || "";
      const from = /^\/(?!\/)/.test(raw) ? raw : "/dashboard";
      router.replace(from);
      router.refresh();
    } catch {
      setBusy(false);
      setError("Couldn't reach the server — check your connection and try again.");
    }
  }

  return (
    <AuroraBackground className="px-4">
      <form
        onSubmit={submit}
        className="relative mx-auto flex w-full max-w-[380px] flex-col items-center overflow-hidden rounded-2xl
          border border-line bg-surface/80 px-7 py-9 text-center shadow-pop backdrop-blur-sm"
      >
        <BorderBeam size={180} duration={12} />

        <LilyMark size={44} />

        <p className="mt-6 text-xl font-light tracking-wide text-ink/60">{GREETING}</p>

        <label className="block w-full mt-8 text-left">
          <span className="block text-[11px] uppercase tracking-wide text-faint mb-1">Email</span>
          <input
            type="email"
            autoComplete="username"
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={busy}
            className="w-full rounded-xl bg-white px-3.5 py-2.5 text-[15px] text-ink outline-none border border-line
              focus:border-primary focus:ring-2 focus:ring-primary/20 transition disabled:opacity-60"
          />
        </label>

        <label className="block w-full mt-3 text-left">
          <span className="block text-[11px] uppercase tracking-wide text-faint mb-1">Password</span>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={busy}
            className="w-full rounded-xl bg-white px-3.5 py-2.5 text-[15px] text-ink outline-none border border-line
              focus:border-primary focus:ring-2 focus:ring-primary/20 transition disabled:opacity-60"
          />
        </label>

        <button
          type="submit"
          disabled={busy || !email.trim() || !password}
          className="mt-5 w-full rounded-xl bg-primary hover:bg-primary-hover text-white text-[15px] font-semibold
            py-2.5 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>

        <div className="mt-3 min-h-5">
          {error && <p className="text-[13px] text-loss">{error}</p>}
        </div>

        <p className="mt-4 text-[12px] text-faint">
          New here? Message the Lily bot on Telegram with your invite code to set up your company.
        </p>
      </form>
    </AuroraBackground>
  );
}
