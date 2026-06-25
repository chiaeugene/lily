"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AuroraBackground } from "@/components/ui/aurora-background";
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

// Pick one greeting per session load — doesn't cycle
const GREETING = GREETINGS[Math.floor(Math.random() * GREETINGS.length)];

export default function LoginPage() {
  const router = useRouter();
  const [digits, setDigits] = useState<string[]>(Array(LEN).fill(""));
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const refs = useRef<(HTMLInputElement | null)[]>([]);

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
    <AuroraBackground className="px-4">
      <div className="flex flex-col items-center text-center">
        <LilyMark size={44} />

        <p className="mt-7 text-xl font-light tracking-wide text-ink/60">{GREETING}</p>

        <div className={`mt-8 flex justify-center gap-2.5 ${error ? "animate-[shake_0.3s]" : ""}`}>
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
              className={`w-11 h-13 rounded-xl bg-white text-center text-xl font-semibold text-ink outline-none border transition
                ${error ? "border-loss" : "border-line focus:border-primary focus:ring-2 focus:ring-primary/20"}`}
            />
          ))}
        </div>

        <div className="mt-3 h-5">
          {error && <p className="text-[13px] text-loss">Incorrect passcode — try again</p>}
          {busy && !error && <p className="text-[13px] text-muted">Unlocking…</p>}
        </div>
      </div>
    </AuroraBackground>
  );
}
