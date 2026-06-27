// In-memory store seeded with real group data. This is DEMO_MODE: the app runs
// and is fully clickable without Supabase. When SUPABASE env vars are present,
// lib/repo.ts routes to Postgres instead (schema in supabase/schema.sql).

import type {
  Customer,
  Product,
  MarginRule,
  Order,
  Transaction,
  AuditEntry,
  CompanyKey,
} from "./types";
import { SEED_PRODUCTS } from "./catalog";

function todayDDMMYYYY(d = new Date()): string {
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

export interface Store {
  customers: Customer[];
  products: Product[];
  marginRules: MarginRule[];
  orders: Order[];
  transactions: Transaction[];
  audit: AuditEntry[];
  counters: Record<CompanyKey, number>;
}

function seed(): Store {
  const customers: Customer[] = [
    {
      id: "kf-advisor",
      name: "KF ADVISOR",
      addressLines: [
        "A-07-11 MENARA PRIMA",
        "JALAN PJU 1/39 DATARAN PRIMA",
        "47301 PETALING JAYA SELANGOR",
      ],
      tel: "012 621 9399",
    },
    {
      id: "goodwill",
      name: "GOODWILL MARKETING",
      addressLines: ["NO 11 JLN BUNGA KEMBOJA 7D", "TAMAN MUDA 56100 KUALA LUMPUR"],
      tel: "016 891 1682",
    },
  ];

  const products: Product[] = SEED_PRODUCTS;

  // Chain: Tien Ngai (origin) -> Prim -> 3C (sells to customer at RM8.00/kg).
  // Margins are taken by the non-origin companies:
  //  3c   cut RM0.40/kg -> Prim->3C price 7.60
  //  prim cut RM0.40/kg -> TienNgai->Prim price 7.20  (Tien Ngai = origin, no margin rule)
  const marginRules: MarginRule[] = [
    { productId: "tp-48-225", tier: "3c", type: "rm_per_unit", value: 0.4 },
    { productId: "tp-48-225", tier: "prim", type: "rm_per_unit", value: 0.4 },
    { productId: "coreless-57-38-12", tier: "3c", type: "rm_per_unit", value: 3.0 },
    { productId: "coreless-57-38-12", tier: "prim", type: "rm_per_unit", value: 3.0 },
  ];

  return {
    customers,
    products,
    marginRules,
    orders: [
      {
        id: "ord-demo-1",
        source: "telegram",
        rawMessage: "118kg thermal 48gsm 225mm to KF Advisor at 8, cod. rolls 59.5 + 58.5",
        telegramUser: "demo",
        customerId: "kf-advisor",
        customerName: "KF ADVISOR",
        customerAddressLines: customers[0].addressLines,
        customerTel: "012 621 9399",
        terms: "C.O.D.",
        date: todayDDMMYYYY(),
        lines: [
          {
            productId: "tp-48-225",
            productName: "THERMAL PAPER 48GSM 225MM",
            specLines: ["59.5KG-1ROLL", "58.5KG-1ROLL"],
            qty: 118,
            uom: "KGS",
            sellUnitPrice: 8,
          },
        ],
        status: "pending",
        parseConfidence: 0.96,
        parseNotes: "Matched saved customer KF ADVISOR and product THERMAL PAPER 48GSM 225MM.",
        createdAt: new Date().toISOString(),
      },
    ],
    transactions: [],
    audit: [
      {
        id: "a0",
        at: new Date().toISOString(),
        actor: "system",
        action: "seed",
        detail: `Demo data loaded (3 companies, 2 customers, ${products.length} products, margin rules).`,
      },
    ],
    // start counters near the real last-seen numbers so generated nos look live
    counters: { tien_ngai: 187880, "3c": 7, prim: 4 },
  };
}

// Persist across HMR reloads in dev via globalThis.
const g = globalThis as unknown as { __lilyStore?: Store };
export const store: Store = g.__lilyStore ?? (g.__lilyStore = seed());

export { todayDDMMYYYY };
