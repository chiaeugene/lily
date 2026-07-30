import { cache } from "react";
import { cookies } from "next/headers";
import { verifySessionCookie } from "./session";
import { getUserById, getTenant, type Tenant, type User } from "./tenant";

const AUTH_COOKIE = "lily_auth";
const TENANT_COOKIE = "lily_tenant"; // super-admin "acting as" override

export interface Session {
  user: User;
  tenant: Tenant;
}

/**
 * The signed-in user and the tenant whose data they're currently working in.
 * Returns null when not authenticated — callers MUST treat null as "no access"
 * rather than falling back to an unscoped query, or one tenant's books would
 * leak into another's.
 */
export const getSession = cache(async function getSession(): Promise<Session | null> {
  const jar = await cookies();
  const userId = await verifySessionCookie(jar.get(AUTH_COOKIE)?.value);
  if (!userId) return null;

  const user = await getUserById(userId);
  if (!user || !user.active) return null;

  // A super-admin may act inside any tenant; everyone else is pinned to their own.
  const requested = user.role === "super_admin" ? jar.get(TENANT_COOKIE)?.value : undefined;
  const tenantId = requested || user.tenantId;
  if (!tenantId) return null;

  const tenant = await getTenant(tenantId);
  if (!tenant || !tenant.active) return null;

  return { user, tenant };
});

/** Throws when unauthenticated — use in route handlers that must not proceed. */
export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) throw new Error("unauthenticated");
  return session;
}

/** The tenant id to scope queries by, or null when signed out. */
export async function getTenantId(): Promise<string | null> {
  return (await getSession())?.tenant.id ?? null;
}

/** Display name for audit-log attribution. */
export async function getCurrentActor(): Promise<string> {
  return (await getSession())?.user.name ?? "unknown";
}

export const TENANT_COOKIE_NAME = TENANT_COOKIE;
