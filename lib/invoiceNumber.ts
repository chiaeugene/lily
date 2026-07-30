import type { CompanyKey, Company } from "./types";
import { COMPANIES } from "./companies";

// Sequence width per company, matching the source invoices:
//   tien_ngai running -> INV-187880 (6 digits)
//   3c        ym/seq   -> INV-2603/007 (3 digits)
//   prim      ym/seq   -> I-2606/0004 (4 digits)
const SEQ_WIDTH: Record<CompanyKey, number> = { tien_ngai: 6, "3c": 3, prim: 4 };

export function formatInvoiceNo(
  company: CompanyKey,
  seq: number,
  date = new Date(),
  // Passed in for tenants outside the Tien Ngai group, whose company keys
  // aren't in the hardcoded COMPANIES map (a lookup miss used to crash here).
  explicit?: Company,
): string {
  const c = explicit ?? COMPANIES[company];
  const width = SEQ_WIDTH[company] ?? 4;
  const padded = String(seq).padStart(width, "0");
  if (c.invoiceFormat === "running") {
    return `${c.invoicePrefix}${padded}`;
  }
  // ym: prefix + YYMM + "/" + seq
  const yy = String(date.getFullYear()).slice(-2);
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  return `${c.invoicePrefix}${yy}${mm}/${padded}`;
}
