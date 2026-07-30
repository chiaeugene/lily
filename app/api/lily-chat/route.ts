import { NextRequest, NextResponse } from "next/server";
import { askLily, type ChatMessage } from "@/lib/lilyChat";
import { getSession } from "@/lib/currentUser";
import { getTenantCompanies } from "@/lib/tenantCompanies";

const MAX_HISTORY = 12;

// POST { messages: ChatMessage[] } -> the assistant's reply text.
export async function POST(req: NextRequest) {
  // The chat's tools read real tenant data — a session is non-negotiable.
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const messages: unknown = body?.messages;
  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: "messages required" }, { status: 400 });
  }
  const history: ChatMessage[] = messages
    .filter(
      (m): m is ChatMessage =>
        m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string",
    )
    .slice(-MAX_HISTORY);
  if (!history.length) return NextResponse.json({ error: "no valid messages" }, { status: 400 });

  try {
    const companies = await getTenantCompanies();
    const reply = await askLily(history, {
      businessName: session.tenant.name,
      cascade: companies.length > 1,
    });
    return NextResponse.json({ reply });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "chat failed" }, { status: 500 });
  }
}
