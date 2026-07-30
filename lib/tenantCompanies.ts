import { scopedDb } from "./scopedDb";
import { getTenant } from "./tenant";
import { scopeTenant } from "./tenantScope";
import { COMPANIES, CHAIN } from "./companies";
import { isDemoMode } from "./env";
import type { Company, CompanyKey } from "./types";

/**
 * Which legal entity issues a document, for the CURRENT tenant.
 *
 * This used to be two hardcoded constants — QUOTE_COMPANY = "3c" and
 * PO_COMPANY = "tien_ngai" — which meant every tenant's quotation printed as
 * "3C INDUSTRIES SDN BHD" and every purchase order as "TIEN NGAI MACHINERY".
 * Correct for the Tien Ngai group, badly wrong for anybody else.
 *
 * Now: a tenant's own companies come from the tenant-scoped `companies` table.
 * A tenant with no rows yet (i.e. any newly onboarded business) gets a sensible
 * entity synthesised from its own name, so its paperwork is right from day one
 * with no setup step.
 */

function synthesise(tenantId: string, name: string): Company {
  return {
    key: "primary" as CompanyKey,
    name: name.toUpperCase(),
    regNo: "",
    addressLines: [],
    tel: "",
    email: "",
    banks: [],
    invoiceFormat: "ym",
    invoicePrefix: "INV-",
    showLogo: false,
    showQr: false,
    showLhdnLink: false,
    showRoundingRow: false,
    showAuthorisedSignature: true,
  };
}

/** Every invoicing entity belonging to the current tenant. */
export async function getTenantCompanies(explicitTenantId?: string): Promise<Company[]> {
  const tenantId = await scopeTenant(explicitTenantId);

  // The Tien Ngai group's three entities live in code (their exact letterhead
  // was transcribed from real invoices), so keep using them for that tenant.
  if (isDemoMode || tenantId === "tien-ngai") {
    return CHAIN.map((k) => COMPANIES[k]);
  }

  const { data } = await scopedDb(tenantId).then((db) => db.from("companies").select("*"));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows: any[] = data ?? [];
  if (rows.length > 0) {
    return rows.map((r) => ({
      key: r.key as CompanyKey,
      name: r.name,
      regNo: r.reg_no ?? "",
      tinNo: r.tin_no ?? undefined,
      formerlyKnownAs: r.formerly_known_as ?? undefined,
      addressLines: r.address_lines ?? [],
      tel: r.tel ?? "",
      email: r.email ?? "",
      banks: r.banks ?? [],
      invoiceFormat: r.invoice_format ?? "ym",
      invoicePrefix: r.invoice_prefix ?? "INV-",
      showLogo: r.show_logo ?? false,
      logoText: r.logo_text ?? undefined,
      showQr: r.show_qr ?? false,
      qrInFooter: r.qr_in_footer ?? undefined,
      showLhdnLink: r.show_lhdn_link ?? false,
      showRoundingRow: r.show_rounding_row ?? false,
      showAuthorisedSignature: r.show_authorised_signature ?? true,
      paymentQrDataUrl: r.payment_qr_data_url ?? undefined,
    }));
  }

  const tenant = await getTenant(tenantId);
  return [synthesise(tenantId, tenant?.name ?? tenantId)];
}

/**
 * The entity that issues a given document type.
 *
 * Cascade tenants (Tien Ngai) keep their convention: the customer-facing
 * company quotes and invoices the customer, the origin company raises POs.
 * Everyone else has one entity that does all three.
 */
export async function getIssuingCompany(
  purpose: "quote" | "po" | "invoice",
  explicitTenantId?: string,
): Promise<Company> {
  const tenantId = await scopeTenant(explicitTenantId);
  const companies = await getTenantCompanies(tenantId);
  if (companies.length === 1) return companies[0];

  const tenant = await getTenant(tenantId);
  if (tenant?.cascadeEnabled) {
    // CHAIN runs origin → customer-facing.
    const customerFacing = companies[companies.length - 1];
    const origin = companies[0];
    return purpose === "po" ? origin : customerFacing;
  }
  return companies[0];
}
