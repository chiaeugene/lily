// MyInvois (LHDN e-Invoice) integration.
//
// Configuration (Render env vars, obtained from the MyTax portal after the
// taxpayer registers an ERP/intermediary):
//   MYINVOIS_CLIENT_ID       — from LHDN MyTax portal
//   MYINVOIS_CLIENT_SECRET   — from LHDN MyTax portal
//   MYINVOIS_ENV             — "sandbox" (default) | "production"
//
// Until these are set, isMyinvoisConfigured() is false and no e-Invoice UI or
// invoice marks appear anywhere — no placeholder "LHDN Validated" badges.
//
// Notes / limitations of this v1:
// - Submits UBL 2.1 JSON, document version 1.0 (unsigned). Version 1.1 requires
//   an X.509 digital signature — that needs the taxpayer's soft cert and is the
//   scope of a later phase.
// - Buyer TIN falls back to the LHDN "general public" TIN when the customer's
//   TIN is unknown. Store real customer TINs before production use.
// - The issuing Company is passed in by the caller (tenant-aware): each tenant
//   submits under its own entity's TIN.

import type { Invoice, Company } from "./types";

const BASES = {
  sandbox: "https://preprod-api.myinvois.hasil.gov.my",
  production: "https://api.myinvois.hasil.gov.my",
};

function env(): "sandbox" | "production" {
  return process.env.MYINVOIS_ENV === "production" ? "production" : "sandbox";
}

export function isMyinvoisConfigured(): boolean {
  return !!(process.env.MYINVOIS_CLIENT_ID && process.env.MYINVOIS_CLIENT_SECRET);
}

export function myinvoisEnvLabel(): string {
  return env() === "production" ? "Production" : "Sandbox (pre-prod)";
}

async function getToken(): Promise<string> {
  const res = await fetch(`${BASES[env()]}/connect/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: process.env.MYINVOIS_CLIENT_ID!,
      client_secret: process.env.MYINVOIS_CLIENT_SECRET!,
      scope: "InvoicingAPI",
    }),
  });
  if (!res.ok) throw new Error(`MyInvois auth failed (${res.status}): ${await res.text()}`);
  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

/** dd/MM/yyyy -> yyyy-MM-dd (LHDN wants ISO). */
function isoDate(d: string): string {
  const m = d.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : d;
}

// LHDN "general public" buyer TIN, used when the real customer TIN is unknown.
const GENERAL_PUBLIC_TIN = "EI00000000010";

/** Map one invoice to a minimal UBL 2.1 JSON Invoice (v1.0, unsigned). */
function toUbl(inv: Invoice, c: Company): Record<string, unknown> {
  const supplierTin = c.tinNo ?? GENERAL_PUBLIC_TIN;
  return {
    _D: "urn:oasis:names:specification:ubl:schema:xsd:Invoice-2",
    _A: "urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2",
    _B: "urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2",
    Invoice: [
      {
        ID: [{ _: inv.invoiceNo }],
        IssueDate: [{ _: isoDate(inv.date) }],
        IssueTime: [{ _: "00:00:00Z" }],
        InvoiceTypeCode: [{ _: "01", listVersionID: "1.0" }],
        DocumentCurrencyCode: [{ _: "MYR" }],
        AccountingSupplierParty: [
          {
            Party: [
              {
                PartyLegalEntity: [{ RegistrationName: [{ _: c.name }] }],
                PartyIdentification: [
                  { ID: [{ _: supplierTin, schemeID: "TIN" }] },
                  { ID: [{ _: c.regNo.split(" ")[0] || "NA", schemeID: "BRN" }] },
                ],
                PostalAddress: [
                  {
                    AddressLine: c.addressLines.map((l) => ({ Line: [{ _: l }] })),
                    CityName: [{ _: "" }],
                    CountrySubentityCode: [{ _: "10" }],
                    Country: [{ IdentificationCode: [{ _: "MYS" }] }],
                  },
                ],
                Contact: [{ Telephone: [{ _: c.tel }], ElectronicMail: [{ _: c.email }] }],
              },
            ],
          },
        ],
        AccountingCustomerParty: [
          {
            Party: [
              {
                PartyLegalEntity: [{ RegistrationName: [{ _: inv.toName }] }],
                PartyIdentification: [{ ID: [{ _: GENERAL_PUBLIC_TIN, schemeID: "TIN" }] }],
                PostalAddress: [
                  {
                    AddressLine: inv.toAddressLines.map((l) => ({ Line: [{ _: l }] })),
                    CityName: [{ _: "" }],
                    CountrySubentityCode: [{ _: "10" }],
                    Country: [{ IdentificationCode: [{ _: "MYS" }] }],
                  },
                ],
              },
            ],
          },
        ],
        InvoiceLine: inv.lines.map((l) => ({
          ID: [{ _: String(l.item) }],
          InvoicedQuantity: [{ _: l.qty, unitCode: "KGM" }],
          LineExtensionAmount: [{ _: l.total, currencyID: "MYR" }],
          Item: [
            {
              Description: [{ _: l.description }],
              CommodityClassification: [{ ItemClassificationCode: [{ _: "022", listID: "CLASS" }] }],
            },
          ],
          Price: [{ PriceAmount: [{ _: l.unitPrice, currencyID: "MYR" }] }],
          TaxTotal: [
            {
              TaxAmount: [{ _: 0, currencyID: "MYR" }],
              TaxSubtotal: [
                {
                  TaxableAmount: [{ _: l.total, currencyID: "MYR" }],
                  TaxAmount: [{ _: 0, currencyID: "MYR" }],
                  TaxCategory: [{ ID: [{ _: "06" }], TaxScheme: [{ ID: [{ _: "OTH", schemeID: "UN/ECE 5153" }] }] }],
                },
              ],
            },
          ],
        })),
        TaxTotal: [
          {
            TaxAmount: [{ _: 0, currencyID: "MYR" }],
            TaxSubtotal: [
              {
                TaxableAmount: [{ _: inv.subtotal, currencyID: "MYR" }],
                TaxAmount: [{ _: 0, currencyID: "MYR" }],
                TaxCategory: [{ ID: [{ _: "06" }], TaxScheme: [{ ID: [{ _: "OTH", schemeID: "UN/ECE 5153" }] }] }],
              },
            ],
          },
        ],
        LegalMonetaryTotal: [
          {
            LineExtensionAmount: [{ _: inv.subtotal, currencyID: "MYR" }],
            TaxExclusiveAmount: [{ _: inv.subtotal, currencyID: "MYR" }],
            TaxInclusiveAmount: [{ _: inv.subtotal, currencyID: "MYR" }],
            PayableRoundingAmount: [{ _: inv.roundingAdj, currencyID: "MYR" }],
            PayableAmount: [{ _: inv.finalTotal, currencyID: "MYR" }],
          },
        ],
      },
    ],
  };
}

export interface SubmitResult {
  ok: boolean;
  uid?: string; // submission uid
  status: "submitted" | "invalid";
  detail?: string;
}

/** Submit one invoice to MyInvois under the issuing company's TIN. */
export async function submitInvoice(inv: Invoice, company: Company): Promise<SubmitResult> {
  const token = await getToken();
  const json = JSON.stringify(toUbl(inv, company));
  const base64 = Buffer.from(json).toString("base64");
  const { createHash } = await import("crypto");
  const hash = createHash("sha256").update(json).digest("hex");

  const res = await fetch(`${BASES[env()]}/api/v1.0/documentsubmissions`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify({
      documents: [{ format: "JSON", document: base64, documentHash: hash, codeNumber: inv.invoiceNo }],
    }),
  });
  const data = (await res.json().catch(() => ({}))) as {
    submissionUid?: string;
    acceptedDocuments?: { uuid: string; invoiceCodeNumber: string }[];
    rejectedDocuments?: { invoiceCodeNumber: string; error?: { message?: string } }[];
    error?: { message?: string };
  };

  if (!res.ok) {
    return { ok: false, status: "invalid", detail: data.error?.message ?? `HTTP ${res.status}` };
  }
  if (data.rejectedDocuments?.length) {
    return {
      ok: false,
      status: "invalid",
      uid: data.submissionUid,
      detail: data.rejectedDocuments[0]?.error?.message ?? "Rejected by LHDN validation",
    };
  }
  return { ok: true, status: "submitted", uid: data.submissionUid };
}
