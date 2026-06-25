// PDF helpers.
//
// On Linux (Render): puppeteer-core + @sparticuz/chromium → real PDF bytes.
// On Windows (dev) or if Chromium unavailable → fallback to HTML+autoprint.

export function withAutoPrint(html: string): string {
  return html.replace(
    "</body>",
    `<script>window.addEventListener('load',()=>setTimeout(()=>window.print(),350));</script></body>`,
  );
}

/** Combine several invoice HTML docs into one print job with page breaks. */
export function bundleHtml(docs: string[]): string {
  const bodies = docs
    .map((d) => {
      const m = d.match(/<body>([\s\S]*?)<\/body>/);
      return `<div class="page">${m ? m[1] : d}</div>`;
    })
    .join("");
  const style = docs[0]?.match(/<style>[\s\S]*?<\/style>/)?.[0] ?? "";
  return `<!doctype html><html><head><meta charset="utf-8"/>${style}
  <style>.page{page-break-after:always;} .page:last-child{page-break-after:auto;}</style>
  </head><body>${bodies}
  <script>window.addEventListener('load',()=>setTimeout(()=>window.print(),400));</script>
  </body></html>`;
}

/**
 * Render invoice HTML to a PDF buffer using headless Chromium.
 * Returns null if Chromium is unavailable (Windows dev) — callers should
 * fall back to the HTML+autoprint response.
 */
export async function renderPdf(html: string): Promise<Buffer | null> {
  try {
    // Dynamic imports so the packages are only loaded when needed and don't
    // break on Windows where @sparticuz/chromium has no binary.
    const puppeteer = await import("puppeteer-core");

    let executablePath: string;
    const extraArgs: string[] = [];

    if (process.platform === "linux") {
      const chromium = await import("@sparticuz/chromium");
      executablePath = await chromium.default.executablePath();
      extraArgs.push(...(chromium.default.args ?? []));
    } else {
      // Local dev on Windows — try the installed system Chrome.
      const winPaths = [
        "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
        "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
        "C:\\Users\\user\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe",
      ];
      const { existsSync } = await import("fs");
      const found = winPaths.find((p) => existsSync(p));
      if (!found) return null;
      executablePath = found;
    }

    const browser = await puppeteer.default.launch({
      executablePath,
      headless: true,
      args: [
        ...extraArgs,
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
      ],
    });

    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: "networkidle0", timeout: 15_000 });
      const pdf = await page.pdf({
        format: "A4",
        printBackground: true,
        margin: { top: "12mm", bottom: "12mm", left: "12mm", right: "12mm" },
      });
      return Buffer.from(pdf);
    } finally {
      await browser.close();
    }
  } catch {
    return null;
  }
}
