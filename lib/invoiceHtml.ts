import type { Invoice } from "./types";
import { COMPANIES, STANDARD_NOTES } from "./companies";
import { fmt2, fmtUnit } from "./money";

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// A small deterministic QR-style placeholder (real QR can be swapped in later).
function fauxQr(): string {
  let cells = "";
  const seed = 7;
  for (let y = 0; y < 9; y++)
    for (let x = 0; x < 9; x++) {
      const on = ((x * 13 + y * 7 + seed) % 3 === 0) || x === 0 || y === 0 || x === 8 || y === 8;
      if (on) cells += `<rect x="${x * 6}" y="${y * 6}" width="6" height="6"/>`;
    }
  return `<svg viewBox="0 0 54 54" width="62" height="62">${cells}</svg>`;
}

/** Full standalone A4 invoice HTML for one company skin. */
export function invoiceHtml(inv: Invoice): string {
  const c = COMPANIES[inv.company];

  const header = `
    <div class="hdr">
      ${c.showLogo ? `<div class="logo">${esc(c.logoText ?? "")}</div>` : ""}
      ${
        c.showQr || c.showLhdnLink
          ? `<div class="hdr-right">${c.showQr ? fauxQr() : ""}${
              c.showLhdnLink ? `<div class="lhdn">LHDN Validated<br/>Link</div>` : ""
            }</div>`
          : ""
      }
      <div class="co-name">${esc(c.name)}</div>
      <div class="co-meta">Reg No : ${esc(c.regNo)}${c.tinNo ? `&nbsp;&nbsp;TIN NO : ${esc(c.tinNo)}` : ""}</div>
      ${c.formerlyKnownAs ? `<div class="co-meta italic">(${esc(c.formerlyKnownAs)})</div>` : ""}
      ${c.addressLines.map((l) => `<div class="co-meta">${esc(l)}</div>`).join("")}
      <div class="co-meta">Tel: ${esc(c.tel)}&nbsp;&nbsp;Email: ${esc(c.email)}</div>
    </div>`;

  const rows = inv.lines
    .map(
      (l) => `
      <tr>
        <td class="c-item">${l.item}.</td>
        <td class="c-desc">
          <div class="desc-main">${esc(l.description)}</div>
          ${l.specLines.map((s) => `<div class="desc-spec">${esc(s)}</div>`).join("")}
        </td>
        <td class="c-qty">${l.qty}</td>
        <td class="c-uom">${esc(l.uom)}</td>
        <td class="c-price">${fmtUnit(l.unitPrice)}</td>
        <td class="c-disc">${l.disc ? fmt2(l.disc) : ""}</td>
        <td class="c-total">${fmt2(l.total)}</td>
      </tr>`,
    )
    .join("");

  const totalsBox = c.showRoundingRow
    ? `
      <div class="totrow"><span>Total</span><span class="box">${fmt2(inv.subtotal)}</span></div>
      <div class="totrow"><span>Rounding Adj.</span><span class="box">${fmt2(inv.roundingAdj)}</span></div>
      <div class="totrow bold"><span>Final Total</span><span class="box">${fmt2(inv.finalTotal)}</span></div>`
    : `<div class="totrow bold"><span>Total</span><span class="box">${fmt2(inv.finalTotal)}</span></div>`;

  const notes = STANDARD_NOTES.map((n, i) => {
    if (i === 0) {
      return `<div class="note">1.${esc(n.replace("{COMPANY}", ""))}<b>${esc(c.name)}</b></div>
              <div class="note bank"><b>Account No:</b> ${c.banks
                .map((b) => `${esc(b.bank)} - ${esc(b.account)}`)
                .join("&nbsp;&nbsp; ")}</div>`;
    }
    return `<div class="note">${i + 1}.${esc(n)}</div>`;
  }).join("");

  const footer = `
    <div class="foot">
      <div class="foot-co">${esc(c.name)}</div>
      <div class="foot-line">This is a computer generated Invoice</div>
      <div class="foot-line">No Signature is required</div>
      ${c.showAuthorisedSignature ? `<div class="sig-line"></div><div class="foot-line">Authorised Signature</div>` : ""}
    </div>`;

  return `<!doctype html><html><head><meta charset="utf-8"/>
<style>
  @page { size: A4; margin: 12mm 12mm; }
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color:#000; font-size: 11px; margin:0; }
  .sheet { width: 186mm; margin: 0 auto; position: relative; }
  .hdr { text-align:center; position:relative; padding-bottom:6px; }
  .logo { position:absolute; left:0; top:0; width:54px; height:54px; border:2px solid #C79A3A;
          border-radius:50%; color:#C79A3A; font-weight:bold; font-size:15px; display:flex;
          align-items:center; justify-content:center; }
  .hdr-right { position:absolute; right:0; top:0; text-align:center; }
  .hdr-right svg { fill:#000; }
  .lhdn { font-size:7px; color:#0a58ca; }
  .co-name { font-family:"Times New Roman",Georgia,serif; font-weight:bold; font-size:20px; letter-spacing:.5px; }
  .co-meta { font-family:"Times New Roman",Georgia,serif; font-size:10px; line-height:1.35; }
  .italic { font-style:italic; }
  hr.rule { border:none; border-top:1px solid #000; margin:4px 0 8px; }
  .title-row { display:flex; align-items:flex-end; justify-content:center; position:relative; margin-bottom:10px; }
  .title { font-weight:bold; font-size:18px; letter-spacing:1px; }
  .inv-no { position:absolute; right:0; bottom:0; font-weight:bold; }
  .meta { display:flex; justify-content:space-between; gap:18px; margin-bottom:10px; }
  .billbox { position:relative; width:54%; padding:10px 12px; min-height:96px; }
  .corner { position:absolute; width:12px; height:12px; }
  .corner.tl { left:0; top:0; border-left:1px solid #000; border-top:1px solid #000; }
  .corner.tr { right:0; top:0; border-right:1px solid #000; border-top:1px solid #000; }
  .corner.bl { left:0; bottom:0; border-left:1px solid #000; border-bottom:1px solid #000; }
  .corner.br { right:0; bottom:0; border-right:1px solid #000; border-bottom:1px solid #000; }
  .bill-name { font-weight:bold; }
  .bill-tel { margin-top:14px; }
  .info { width:42%; }
  .info .r { display:flex; margin-bottom:3px; }
  .info .k { width:92px; color:#000; }
  .info .colon { width:10px; }
  table { width:100%; border-collapse:collapse; }
  thead th { border-top:1px solid #000; border-bottom:1px solid #000; font-weight:normal;
             text-align:left; padding:3px 4px; font-size:11px; }
  th.r, td.r { text-align:right; }
  .sub { font-size:9px; color:#000; }
  td { padding:3px 4px; vertical-align:top; }
  .c-item{width:34px;} .c-qty{width:48px;text-align:center;} .c-uom{width:54px;}
  .c-price{width:90px;text-align:right;} .c-disc{width:50px;text-align:right;} .c-total{width:84px;text-align:right;}
  .desc-spec{ padding-left:14px; }
  .table-end { border-bottom:1px solid #000; }
  .words-tot { display:flex; justify-content:space-between; align-items:flex-start; margin-top:6px; }
  .words { font-size:11px; padding-top:4px; }
  .totals { width:230px; }
  .totrow { display:flex; justify-content:flex-end; gap:8px; align-items:center; margin-bottom:3px; }
  .totrow span:first-child{ font-weight:bold; }
  .totrow .box { display:inline-block; min-width:96px; text-align:right; border:1px solid #000; padding:2px 6px; }
  .totrow.bold .box { font-weight:bold; }
  .bottom { display:flex; justify-content:space-between; margin-top:18px; gap:24px; }
  .notes { width:58%; }
  .note { font-size:10px; line-height:1.35; }
  .note.bank { margin:2px 0; font-weight:bold; }
  .foot { width:38%; text-align:center; align-self:flex-end; }
  .foot-co { font-family:"Times New Roman",Georgia,serif; font-weight:bold; }
  .foot-line { font-family:"Times New Roman",Georgia,serif; font-size:10px; }
  .sig-line { border-top:1px solid #000; margin:26px 12px 4px; }
</style></head>
<body>
  <div class="sheet">
    ${header}
    <hr class="rule"/>
    <div class="title-row"><div class="title">INVOICE</div><div class="inv-no">No. : ${esc(inv.invoiceNo)}</div></div>
    <div class="meta">
      <div class="billbox">
        <span class="corner tl"></span><span class="corner tr"></span>
        <span class="corner bl"></span><span class="corner br"></span>
        <div class="bill-name">${esc(inv.toName)}</div>
        ${inv.toAddressLines.map((l) => `<div>${esc(l)}</div>`).join("")}
        <div class="bill-tel">TEL : ${esc(inv.toTel ?? "")}&nbsp;&nbsp;&nbsp;&nbsp;FAX : ${esc(inv.toFax ?? "")}</div>
      </div>
      <div class="info">
        <div class="r"><span class="k">Your Ref.</span><span class="colon">:</span><span>${esc(inv.yourRef)}</span></div>
        <div class="r"><span class="k">Our D/O No.</span><span class="colon">:</span><span>${esc(inv.doNo)}</span></div>
        <div class="r"><span class="k">Terms</span><span class="colon">:</span><span>${esc(inv.terms)}</span></div>
        <div class="r"><span class="k">Date</span><span class="colon">:</span><span>${esc(inv.date)}</span></div>
        <div class="r"><span class="k">Page</span><span class="colon">:</span><span>1 of 1</span></div>
      </div>
    </div>
    <table>
      <thead><tr>
        <th>Item</th><th>Description</th><th>Qty</th><th>UOM</th>
        <th class="r">U/ Price<div class="sub">RM</div></th><th class="r">Disc.</th>
        <th class="r">Total<div class="sub">RM</div></th>
      </tr></thead>
      <tbody>${rows}<tr class="table-end"><td colspan="7"></td></tr></tbody>
    </table>
    <div class="words-tot">
      <div class="words">${esc(inv.amountInWords)}</div>
      <div class="totals">${totalsBox}</div>
    </div>
    <div class="bottom">
      <div class="notes"><div class="note"><b>Notes :</b></div>${notes}</div>
      ${footer}
    </div>
  </div>
</body></html>`;
}
