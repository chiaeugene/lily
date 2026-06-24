// PDF helpers. The default path injects an auto-print script so the browser's
// native "Save as PDF" produces a pixel-identical file with no server deps.
//
// To switch to true server-side PDF on Render, install:
//   npm i puppeteer-core @sparticuz/chromium
// then implement renderPdf() below and have the routes call it.

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
  // reuse the <style> from the first doc
  const style = docs[0]?.match(/<style>[\s\S]*?<\/style>/)?.[0] ?? "";
  return `<!doctype html><html><head><meta charset="utf-8"/>${style}
  <style>.page{page-break-after:always;} .page:last-child{page-break-after:auto;}</style>
  </head><body>${bodies}
  <script>window.addEventListener('load',()=>setTimeout(()=>window.print(),400));</script>
  </body></html>`;
}
