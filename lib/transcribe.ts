// Speech-to-text for Telegram voice notes via Groq Whisper (OpenAI-compatible
// audio API). Downloads the audio from Telegram, transcribes it (auto-detects
// Mandarin / Malay / English), and returns the transcript — or null on any
// failure so the caller can fall back gracefully. Failures are logged to the
// server console (visible in Render logs) for diagnosis.

const GROQ_URL = "https://api.groq.com/openai/v1/audio/transcriptions";

export async function transcribeVoice(fileId: string): Promise<string | null> {
  const tgToken = process.env.TELEGRAM_BOT_TOKEN;
  const groqKey = process.env.GROQ_API_KEY;
  if (!tgToken || !groqKey || !fileId) {
    console.error("[transcribe] missing token/key/fileId");
    return null;
  }

  try {
    // 1. Resolve the file path on Telegram.
    const fileRes = await fetch(
      `https://api.telegram.org/bot${tgToken}/getFile?file_id=${encodeURIComponent(fileId)}`,
    );
    const fileJson = (await fileRes.json()) as { result?: { file_path?: string } };
    const filePath = fileJson?.result?.file_path;
    if (!filePath) {
      console.error("[transcribe] getFile failed", JSON.stringify(fileJson));
      return null;
    }

    // 2. Download the audio bytes (voice notes are small — well under limits).
    const audioRes = await fetch(`https://api.telegram.org/file/bot${tgToken}/${filePath}`);
    if (!audioRes.ok) {
      console.error("[transcribe] audio download failed", audioRes.status);
      return null;
    }
    const audioBuf = await audioRes.arrayBuffer();

    // Telegram voice notes are Opus-in-OGG with a ".oga" extension, but Whisper
    // only accepts ogg/opus/etc — so normalise ".oga" → ".ogg".
    const raw = (filePath.split(".").pop() || "ogg").toLowerCase();
    const ext = raw === "oga" ? "ogg" : raw;

    // 3. Transcribe via Groq Whisper. Language is auto-detected.
    const form = new FormData();
    form.append("file", new Blob([audioBuf], { type: "audio/ogg" }), `voice.${ext}`);
    form.append("model", process.env.GROQ_STT_MODEL || "whisper-large-v3");
    form.append("response_format", "json");

    const sttRes = await fetch(GROQ_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${groqKey}` },
      body: form,
    });
    if (!sttRes.ok) {
      const body = await sttRes.text().catch(() => "");
      console.error("[transcribe] Groq error", sttRes.status, body.slice(0, 300));
      return null;
    }
    const sttJson = (await sttRes.json()) as { text?: string };
    return (sttJson?.text || "").trim() || null;
  } catch (e) {
    console.error("[transcribe] exception", String((e as Error)?.message ?? e));
    return null;
  }
}
