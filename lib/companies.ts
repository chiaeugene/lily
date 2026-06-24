import type { Company, CompanyKey } from "./types";

// The three group entities, transcribed exactly from the source invoices.
// Held on globalThis so edits (Settings page) persist across dev HMR reloads.
const DEFAULT_COMPANIES: Record<CompanyKey, Company> = {
  prim: {
    key: "prim",
    name: "PRIM PAPER TRADING SDN BHD",
    regNo: "202501032538 (1633949-T)",
    addressLines: ["NO 4554 TAMAN RAWANG 48000 RAWANG SELANGOR"],
    tel: "014 334 9588",
    email: "primpaper4554@gmail.com",
    banks: [{ bank: "AMBANK", account: "888 1068 754 788" }],
    invoiceFormat: "ym",
    invoicePrefix: "I-",
    showLogo: false,
    showQr: false,
    showLhdnLink: false,
    showRoundingRow: false,
    showAuthorisedSignature: true,
  },
  "3c": {
    key: "3c",
    name: "3C INDUSTRIES SDN BHD",
    regNo: "201501001966 (Co.1127298-U)",
    tinNo: "C23707931030",
    formerlyKnownAs: "Formerly known as Tag Paper Roll (M) Sdn Bhd",
    addressLines: [
      "NO.19, JALAN PP 16/5, PERDANA INDUSTRY PARK",
      "TAMAN PUTRA PERDANA 47130 PUCHONG SELANGOR",
    ],
    tel: "03-8322 3188 / 014 334 9588",
    email: "3cindsb@gmail.com",
    banks: [
      { bank: "UOB BANK", account: "258 303 3086" },
      { bank: "RHB BANK", account: "2643 7500 0108 84" },
    ],
    invoiceFormat: "ym",
    invoicePrefix: "INV-",
    showLogo: true,
    logoText: "3C",
    showQr: true,
    showLhdnLink: true,
    showRoundingRow: true,
    showAuthorisedSignature: true,
  },
  tien_ngai: {
    key: "tien_ngai",
    name: "TIEN NGAI MACHINERY SDN BHD",
    regNo: "201101023373 (951509-H)",
    tinNo: "C21874792060",
    addressLines: [
      "NO.19, JALAN PP 16/5, PERDANA INDUSTRY PARK",
      "TAMAN PUTRA PERDANA 47130 PUCHONG SELANGOR",
    ],
    tel: "03 8322 3188 / 014 334 9588",
    email: "tienngaim328@gmail.com",
    banks: [
      { bank: "Alliance Bank", account: "6409 600 100 28643" },
      { bank: "OCBC Bank", account: "190 100 2966" },
      { bank: "UOB Bank", account: "223 303 0726" },
    ],
    invoiceFormat: "running",
    invoicePrefix: "INV-",
    showLogo: false,
    showQr: true,
    showLhdnLink: false,
    showRoundingRow: false,
    showAuthorisedSignature: false,
  },
};

const g = globalThis as unknown as { __lilyCompanies?: Record<CompanyKey, Company> };
export const COMPANIES: Record<CompanyKey, Company> =
  g.__lilyCompanies ?? (g.__lilyCompanies = structuredClone(DEFAULT_COMPANIES));

/**
 * Cascade order, ORIGIN first -> CUSTOMER-FACING last.
 * Tien Ngai supplies Prim, Prim supplies 3C, 3C sells to the end customer.
 * Reordering this array is all that's needed to re-sequence the whole system.
 */
export const CHAIN: CompanyKey[] = ["tien_ngai", "prim", "3c"];

export const STANDARD_NOTES = [
  "All cheques should be crossed and made payable to {COMPANY}",
  "Products sold & deposits paid are strictly not returnable or refundable",
  "All goods supplied shall at all times remain in our property until full payment is settled",
  "Interest will be charged on overdue accounts at the rate of 1.5% per month until payment in full.",
  "Any odjections must be made within five(5) working days from the date of the invoice",
];
