import { AsyncLocalStorage } from "node:async_hooks";
import { getTenantId } from "./currentUser";

/**
 * Ambient tenant for contexts that have no session cookie — chiefly the
 * Telegram webhook, where the "user" is a bot message rather than a browser.
 *
 * AsyncLocalStorage (not a module-level variable) because the server handles
 * requests concurrently: a plain `let currentTenant` would let one company's
 * webhook overwrite another's mid-flight and write rows into the wrong books.
 */
const tenantStore = new AsyncLocalStorage<string>();

/** Runs `fn` with an explicit ambient tenant. Safe under concurrency. */
export function runWithTenant<T>(tenantId: string, fn: () => Promise<T>): Promise<T> {
  return tenantStore.run(tenantId, fn);
}

/**
 * Resolves the tenant a query must be scoped to.
 *
 * Order: explicit argument → ambient (bot/system) → signed-in user → THROW.
 *
 * Throwing is deliberate. If this returned undefined and a caller dropped the
 * `.eq("tenant_id", …)` filter, one company's books would silently appear in
 * another company's dashboard. A loud 500 beats a quiet cross-tenant leak, so
 * there is no "unscoped" fallback anywhere.
 */
export async function scopeTenant(explicit?: string): Promise<string> {
  if (explicit) return explicit;

  const ambient = tenantStore.getStore();
  if (ambient) return ambient;

  // getTenantId reads cookies(), which throws outside a request scope.
  const fromSession = await getTenantId().catch(() => null);
  if (fromSession) return fromSession;

  throw new Error(
    "Refusing to run an unscoped query: no tenant in session, ambient context, or argument.",
  );
}
