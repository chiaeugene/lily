// Downloads a Telegram-hosted file (photo, document) as base64 — used for
// receipt/document capture and AI classification. Mirrors the download step
// in lib/transcribe.ts but returns raw bytes instead of a transcript.

export async function downloadTelegramFile(fileId: string): Promise<{ base64: string; mime: string } | null> {
  const tgToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!tgToken || !fileId) return null;
  try {
    const fileRes = await fetch(
      `https://api.telegram.org/bot${tgToken}/getFile?file_id=${encodeURIComponent(fileId)}`,
    );
    const fileJson = (await fileRes.json()) as { result?: { file_path?: string } };
    const filePath = fileJson?.result?.file_path;
    if (!filePath) return null;

    const dataRes = await fetch(`https://api.telegram.org/file/bot${tgToken}/${filePath}`);
    if (!dataRes.ok) return null;
    const buf = await dataRes.arrayBuffer();

    const ext = (filePath.split(".").pop() || "jpg").toLowerCase();
    const mime = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : ext === "pdf" ? "application/pdf" : "image/jpeg";
    const base64 = Buffer.from(buf).toString("base64");
    return { base64, mime };
  } catch (e) {
    console.error("[telegramFile] download failed", String((e as Error)?.message ?? e));
    return null;
  }
}
