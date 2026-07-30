import { isDemoMode } from "./env";
import { getSupabaseAdmin } from "./supabase";

/**
 * Binds a Telegram account to a Lily user, so an incoming bot message can be
 * attributed to a person and therefore to a company.
 *
 * These queries intentionally use the raw client rather than scopedDb: the bot
 * has no session and no tenant yet — resolving the tenant is the whole point
 * of the lookup. Every one of them is keyed on a unique code or Telegram id,
 * never a broad listing, so nothing cross-tenant is exposed.
 */

export interface LinkedUser {
  userId: string;
  tenantId: string;
  name: string;
  tenantName: string;
}

/** 6-digit code, avoiding leading zeros so it survives being pasted around. */
export function generateLinkCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function setLinkCode(userId: string, phone?: string): Promise<string> {
  const code = generateLinkCode();
  if (isDemoMode) return code;
  const patch: Record<string, unknown> = {
    telegram_link_code: code,
    telegram_user_id: null,
    telegram_linked_at: null,
  };
  if (phone !== undefined) patch.phone = phone;
  await getSupabaseAdmin().from("users").update(patch).eq("id", userId);
  return code;
}

/**
 * Consumes a link code and binds the Telegram account to that user.
 * Returns null when the code is unknown/already used.
 */
export async function redeemLinkCode(code: string, telegramUserId: string): Promise<LinkedUser | null> {
  if (isDemoMode || !code) return null;
  const db = getSupabaseAdmin();

  const { data: user } = await db
    .from("users")
    .select("id, tenant_id, name, active")
    .eq("telegram_link_code", code)
    .maybeSingle();
  if (!user || !user.active || !user.tenant_id) return null;

  // Clear the code so it can't be reused, and bind the Telegram id.
  await db
    .from("users")
    .update({
      telegram_user_id: telegramUserId,
      telegram_linked_at: new Date().toISOString(),
      telegram_link_code: null,
    })
    .eq("id", user.id);

  const { data: tenant } = await db.from("tenants").select("name").eq("id", user.tenant_id).maybeSingle();
  return {
    userId: user.id,
    tenantId: user.tenant_id,
    name: user.name,
    tenantName: tenant?.name ?? user.tenant_id,
  };
}

/** Who is this Telegram account? Null when it has never been linked. */
export async function findUserByTelegramId(telegramUserId: string): Promise<LinkedUser | null> {
  if (isDemoMode || !telegramUserId) return null;
  const db = getSupabaseAdmin();
  const { data: user } = await db
    .from("users")
    .select("id, tenant_id, name, active")
    .eq("telegram_user_id", telegramUserId)
    .maybeSingle();
  if (!user || !user.active || !user.tenant_id) return null;

  const { data: tenant } = await db.from("tenants").select("name, active").eq("id", user.tenant_id).maybeSingle();
  if (!tenant?.active) return null;

  return { userId: user.id, tenantId: user.tenant_id, name: user.name, tenantName: tenant.name };
}
