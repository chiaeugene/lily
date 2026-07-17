// Backend for the "Ask Lily" chat panel. Claude answers questions about real
// orders/transactions/customers via read-only tool-use against the repo —
// it never writes data, so a wrong or hallucinated answer can't corrupt books.

import { repo } from "./repo";
import { daysOverdue, paymentState } from "./payment";

const MODEL = process.env.LILY_CHAT_MODEL || "claude-sonnet-5";

const SYSTEM = `You are Lily, the AI assistant inside a back-office tool for Tien Ngai Machinery,
a Malaysian paper/machinery trading business that invoices through a 3-tier company cascade
(Tien Ngai Machinery -> Prim Paper Trading -> 3C Industries -> customer).

Answer questions about orders, transactions, customers, and sales using the tools provided —
always call a tool to check real data before answering; never guess or make up numbers.
Keep replies short and concrete (numbers, names, dates). Amounts are in RM (Malaysian Ringgit).
If a question needs an action you can't take (editing data, generating an invoice), say so plainly
and point the user to where in the app to do it — you cannot make changes yourself.`;

const TOOLS = [
  {
    name: "get_summary",
    description: "Overall KPIs: pending orders, transaction count, total sales, margin captured, this-month vs last-month sales, and total outstanding (unpaid) amount.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "search_transactions",
    description: "Search transactions by customer name, transaction ID, or invoice number. Returns matching transactions with their invoices.",
    input_schema: {
      type: "object",
      properties: { query: { type: "string", description: "Customer name, TX id, or invoice number to search for" } },
      required: ["query"],
    },
  },
  {
    name: "list_pending_orders",
    description: "Orders waiting for staff verification (not yet turned into invoices).",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "list_overdue",
    description: "Unpaid transactions that are past their due date, with days overdue. Optionally filter to a minimum number of days overdue.",
    input_schema: {
      type: "object",
      properties: { minDays: { type: "number", description: "Only include transactions overdue by at least this many days" } },
    },
  },
] as const;

type ToolUseBlock = { type: "tool_use"; id: string; name: string; input: Record<string, unknown> };
type TextBlock = { type: "text"; text: string };
type ContentBlock = TextBlock | ToolUseBlock | Record<string, unknown>;

async function runTool(name: string, input: Record<string, unknown>): Promise<unknown> {
  switch (name) {
    case "get_summary":
      return repo.kpis();
    case "search_transactions": {
      const q = typeof input.query === "string" ? input.query : "";
      const txs = await repo.search(q);
      return txs.slice(0, 15).map((t) => ({
        id: t.id,
        customer: t.customerName,
        date: t.date,
        total: t.grandTotalSell,
        margin: t.marginCaptured,
        status: t.status,
        payment: paymentState(t),
        daysOverdue: daysOverdue(t),
        invoices: t.invoices.map((i) => `${i.company} ${i.invoiceNo}`),
      }));
    }
    case "list_pending_orders": {
      const orders = await repo.listPendingOrders();
      return orders.slice(0, 20).map((o) => ({
        id: o.id,
        customer: o.customerName,
        date: o.date,
        lines: o.lines.length,
        confidence: o.parseConfidence,
      }));
    }
    case "list_overdue": {
      const minDays = typeof input.minDays === "number" ? input.minDays : 0;
      const all = await repo.allTransactions();
      return all
        .filter((t) => t.status !== "void" && paymentState(t) === "overdue" && daysOverdue(t) >= minDays)
        .sort((a, b) => daysOverdue(b) - daysOverdue(a))
        .slice(0, 30)
        .map((t) => ({
          id: t.id,
          customer: t.customerName,
          total: t.grandTotalSell,
          daysOverdue: daysOverdue(t),
        }));
    }
    default:
      return { error: `unknown tool ${name}` };
  }
}

export type ChatMessage = { role: "user" | "assistant"; content: string };

export async function askLily(history: ChatMessage[]): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return "I'm not connected to an AI backend yet — no ANTHROPIC_API_KEY is set.";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const messages: any[] = history.map((m) => ({ role: m.role, content: m.content }));

  for (let round = 0; round < 5; round++) {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1024,
        system: SYSTEM,
        tools: TOOLS,
        messages,
      }),
    });
    if (!res.ok) {
      throw new Error(`Claude API ${res.status}: ${await res.text()}`);
    }
    const data = (await res.json()) as { content: ContentBlock[]; stop_reason: string };
    const toolUses = data.content.filter((b): b is ToolUseBlock => (b as ToolUseBlock).type === "tool_use");

    if (data.stop_reason !== "tool_use" || toolUses.length === 0) {
      const text = data.content.find((b): b is TextBlock => (b as TextBlock).type === "text")?.text;
      return text?.trim() || "I couldn't come up with an answer for that.";
    }

    messages.push({ role: "assistant", content: data.content });
    const toolResults = await Promise.all(
      toolUses.map(async (tu) => ({
        type: "tool_result" as const,
        tool_use_id: tu.id,
        content: JSON.stringify(await runTool(tu.name, tu.input)),
      })),
    );
    messages.push({ role: "user", content: toolResults });
  }

  return "That question needs more digging than I can do right now — try narrowing it down.";
}
