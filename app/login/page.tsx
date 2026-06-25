"use client";

import { useRef, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { LilyMark } from "@/components/Logo";

const GREETINGS = [
  "Good morning.",
  "Welcome back.",
  "Ready to roll.",
  "Hey there.",
  "Let's get to work.",
  "Back at it.",
  "Hello, boss.",
  "Orders are waiting.",
  "Your desk is clear.",
  "Morning.",
];

const LEN = 6;

export default function LoginPage() {
  const router = useRouter();
  const [digits, setDigits] = useState<string[]>(Array(LEN).fill(""));
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [greetIdx, setGreetIdx] = useState(0);
  const [visible, setVisible] = useState(true);
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    const t = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setGreetIdx((i) => (i + 1) % GREETINGS.length);
        setVisible(true);
      }, 350);
    }, 3500);
    return () => clearInterval(t);
  }, []);

  async function submit(code: string) {
    setBusy(true);
    setError(false);
    const res = await fetch("/api/auth", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code }),
    });
    if (res.ok) {
      const from = new URLSearchParams(window.location.search).get("from") || "/dashboard";
      router.replace(from);
      router.refresh();
    } else {
      setBusy(false);
      setError(true);
      setDigits(Array(LEN).fill(""));
      refs.current[0]?.focus();
    }
  }

  function setAt(i: number, val: string) {
    const v = val.replace(/\D/g, "");
    if (!v) {
      setDigits((d) => d.map((x, idx) => (idx === i ? "" : x)));
      return;
    }
    setError(false);
    const next = [...digits];
    const chars = v.split("");
    let idx = i;
    for (const c of chars) {
      if (idx < LEN) next[idx] = c;
      idx++;
    }
    setDigits(next);
    refs.current[Math.min(i + chars.length, LEN - 1)]?.focus();
    if (next.every((x) => x !== "")) submit(next.join(""));
  }

  function onKey(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !digits[i] && i > 0) refs.current[i - 1]?.focus();
  }

  return (
    <div className="min-h-dvh bg-sidebar flex items-center justify-center px-4 relative overflow-hidden">
      {/* Aurora warm glow */}
      <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="aurora" />
      </div>

      <div className="relative z-10 flex flex-col items-center text-center select-none">
        {/* Logo mark */}
        <LilyMark size={44} />

        {/* Cycling greeting */}
        <div className="mt-8 h-8 flex items-center justify-center">
          <p
            className="text-xl font-light tracking-wide text-white/80 transition-opacity duration-300"
            style={{ opacity: visible ? 1 : 0 }}
          >
            {GREETINGS[greetIdx]}
          </p>
        </div>

        {/* 6-digit passcode */}
        <div className={`mt-10 flex gap-3 ${error ? "animate-[shake_0.3s]" : ""}`}>
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => { refs.current[i] = el; }}
              value={d}
              onChange={(e) => setAt(i, e.target.value)}
              onKeyDown={(e) => onKey(i, e)}
              inputMode="numeric"
              autoFocus={i === 0}
              disabled={busy}
              aria-label={`Passcode digit ${i + 1}`}
              maxLength={1}
              className={`w-11 h-14 rounded-xl text-center text-xl font-semibold outline-none border transition-all
                bg-white/[0.08] text-white caret-transparent
                ${error
                  ? "border-red-400/50 bg-red-400/[0.06]"
                  : "border-white/[0.15] focus:border-white/50 focus:bg-white/[0.12]"
                }`}
            />
          ))}
        </div>

        {/* Status line */}
        <div className="mt-4 h-5">
          {error && <p className="text-sm text-red-300/90">Incorrect — try again</p>}
          {busy && !error && <p className="text-sm text-white/35">Verifying…</p>}
        </div>
      </div>
    </div>
  );
}
