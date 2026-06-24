// Money helpers: rounding, formatting, and Ringgit-in-words.

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Bankers-free standard rounding to the nearest 5 sen (Malaysia rounding mechanism). */
export function roundTo5Sen(n: number): number {
  return Math.round(n * 20) / 20;
}

export function fmt2(n: number): string {
  return n.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Unit price prints to 6 decimals on the source invoices (e.g. 8.000000). */
export function fmtUnit(n: number): string {
  return n.toLocaleString("en-MY", { minimumFractionDigits: 6, maximumFractionDigits: 6 });
}

const ONES = [
  "", "ONE", "TWO", "THREE", "FOUR", "FIVE", "SIX", "SEVEN", "EIGHT", "NINE",
  "TEN", "ELEVEN", "TWELVE", "THIRTEEN", "FOURTEEN", "FIFTEEN", "SIXTEEN",
  "SEVENTEEN", "EIGHTEEN", "NINETEEN",
];
const TENS = ["", "", "TWENTY", "THIRTY", "FORTY", "FIFTY", "SIXTY", "SEVENTY", "EIGHTY", "NINETY"];

function below1000(n: number): string {
  let s = "";
  if (n >= 100) {
    s += ONES[Math.floor(n / 100)] + " HUNDRED";
    n %= 100;
    if (n) s += " ";
  }
  if (n >= 20) {
    s += TENS[Math.floor(n / 10)];
    if (n % 10) s += " " + ONES[n % 10];
  } else if (n > 0) {
    s += ONES[n];
  }
  return s;
}

function intToWords(n: number): string {
  if (n === 0) return "ZERO";
  const parts: string[] = [];
  const scales = [
    { v: 1_000_000_000, w: "BILLION" },
    { v: 1_000_000, w: "MILLION" },
    { v: 1_000, w: "THOUSAND" },
  ];
  for (const { v, w } of scales) {
    if (n >= v) {
      parts.push(below1000(Math.floor(n / v)) + " " + w);
      n %= v;
    }
  }
  if (n > 0) parts.push(below1000(n));
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

/**
 * "RINGGIT MALAYSIA NINE HUNDRED FORTY FOUR ONLY"
 * with sen: "... AND SEN FIFTY ONLY"
 */
export function ringgitInWords(amount: number): string {
  const rounded = round2(amount);
  const ringgit = Math.floor(rounded);
  const sen = Math.round((rounded - ringgit) * 100);
  let s = "RINGGIT MALAYSIA " + intToWords(ringgit);
  if (sen > 0) s += " AND CENTS " + intToWords(sen);
  return s + " ONLY";
}
