import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

// One-time webhook registration. Visit /api/setup-webhook in a browser
// (while logged in) to tell Telegram where to send bot messages.
// Safe to call multiple times — Telegram just overwrites the old URL.
export async function GET(_req: NextRequest) {
  // must be logged in
  const jar = await cookies();
  const auth = jar.get("lily_auth")?.value;
  if (auth !== (process.env.LILY_AUTH_TOKEN || "lily-authed")) {
    return NextResponse.redirect(new URL("/login", process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"));
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET || "lily-hook";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;

  if (!token) {
    return new NextResponse(html("Missing TELEGRAM_BOT_TOKEN", "Set it in your Render environment variables and redeploy.", false), {
      headers: { "content-type": "text/html" },
    });
  }
  if (!appUrl) {
    return new NextResponse(html("Missing NEXT_PUBLIC_APP_URL", "Set it in your Render environment variables and redeploy.", false), {
      headers: { "content-type": "text/html" },
    });
  }

  const webhookUrl = `${appUrl}/api/telegram/${secret}`;
  const res = await fetch(
    `https://api.telegram.org/bot${token}/setWebhook?url=${encodeURIComponent(webhookUrl)}`,
  );
  const data = (await res.json()) as { ok: boolean; description?: string };

  if (data.ok) {
    return new NextResponse(
      html("Webhook registered", `Telegram will now send messages to:<br><code>${webhookUrl}</code><br><br>Send your bot any message to place an order.`, true),
      { headers: { "content-type": "text/html" } },
    );
  } else {
    return new NextResponse(
      html("Registration failed", data.description ?? "Unknown error from Telegram API.", false),
      { headers: { "content-type": "text/html" } },
    );
  }
}

function html(title: string, body: string, ok: boolean) {
  const color = ok ? "#16a34a" : "#dc2626";
  const icon  = ok ? "✓" : "✗";
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title>
<style>body{font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f6f7f9}
.card{background:#fff;border-radius:16px;padding:40px 48px;box-shadow:0 4px 24px rgba(0,0,0,.08);max-width:480px;text-align:center}
.icon{font-size:48px;color:${color};margin-bottom:16px}.title{font-size:20px;font-weight:700;color:#0f172a;margin-bottom:12px}
.body{font-size:14px;color:#64748b;line-height:1.6}code{background:#f1f5f9;padding:2px 6px;border-radius:4px;font-size:12px}
a{color:#4f46e5;text-decoration:none;font-weight:600}</style></head>
<body><div class="card"><div class="icon">${icon}</div><div class="title">${title}</div>
<div class="body">${body}</div>
<br><a href="/dashboard">← Back to dashboard</a></div></body></html>`;
}
