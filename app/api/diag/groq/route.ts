import { NextResponse } from "next/server";

// Gated diagnostic (middleware requires auth). Verifies the GROQ_API_KEY is
// actually valid by calling Groq's models endpoint — never exposes the key
// (only a 4-char prefix) and lists available Whisper models.
export async function GET() {
  const key = process.env.GROQ_API_KEY;
  if (!key) {
    return NextResponse.json({ keyPresent: false, valid: false, error: "GROQ_API_KEY not set in env" });
  }
  try {
    const r = await fetch("https://api.groq.com/openai/v1/models", {
      headers: { Authorization: `Bearer ${key}` },
    });
    let body: unknown = null;
    try { body = await r.json(); } catch { /* non-json */ }
    const data = (body as { data?: { id: string }[] })?.data ?? [];
    const whisperModels = data.map((m) => m.id).filter((id) => /whisper/i.test(id));
    const errMsg = (body as { error?: { message?: string } })?.error?.message;
    return NextResponse.json({
      keyPresent: true,
      keyPrefix: `${key.slice(0, 4)}…`,
      status: r.status,
      valid: r.ok,
      configuredModel: process.env.GROQ_STT_MODEL || "whisper-large-v3 (default)",
      whisperModels,
      modelAvailable: whisperModels.includes(process.env.GROQ_STT_MODEL || "whisper-large-v3"),
      error: r.ok ? undefined : (errMsg ?? `HTTP ${r.status}`),
    });
  } catch (e) {
    return NextResponse.json({ keyPresent: true, valid: false, error: String((e as Error)?.message ?? e) });
  }
}
