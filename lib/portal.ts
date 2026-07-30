import { getSupabaseAdmin } from "./supabase";
import { isDemoMode } from "./env";
import { repo } from "./repo";
import type { Customer } from "./types";

/**
 * Resolve a customer-portal token WITHOUT a session.
 *
 * The portal is public — the customer clicking their link has no Lily login,
 * so there is no session tenant to scope by. Every repo call goes through
 * scopedDb(), which (correctly) refuses to run unscoped… which meant the
 * portal threw before it could even find the customer. The token is the
 * credential here: it's an opaque random secret, so looking it up across
 * tenants is safe, and the row it matches tells us which tenant to scope
 * everything else to (via runWithTenant).
 */
export async function findPortalCustomer(
  token: string,
): Promise<{ customer: Customer; tenantId: string } | undefined> {
  if (!token) return undefined;
  if (isDemoMode) {
    const customer = await repo.getCustomerByPortalToken(token);
    return customer ? { customer, tenantId: "tien-ngai" } : undefined;
  }
  const { data } = await getSupabaseAdmin()
    .from("customers")
    .select("*")
    .eq("portal_token", token)
    .maybeSingle();
  if (!data) return undefined;
  return {
    tenantId: data.tenant_id,
    customer: {
      id: data.id,
      name: data.name,
      addressLines: data.address_lines ?? [],
      tel: data.tel ?? undefined,
      fax: data.fax ?? undefined,
      portalToken: data.portal_token ?? undefined,
    },
  };
}
