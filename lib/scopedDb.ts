import { getSupabaseAdmin } from "./supabase";
import { scopeTenant } from "./tenantScope";

/**
 * A Supabase client that CANNOT issue an unscoped query.
 *
 * Every read gets `.eq("tenant_id", t)` appended and every write gets
 * `tenant_id` injected, automatically. This is deliberately a chokepoint
 * rather than 56 hand-written `.eq("tenant_id", …)` calls scattered through
 * repo.ts — with hand-written filters, forgetting exactly one is enough to
 * leak one company's books into another company's dashboard, and that bug is
 * invisible until you have a second tenant.
 *
 * Tables that are genuinely global (tenants, users, invite_codes) must keep
 * using getSupabaseAdmin() directly — they are not tenant-scoped data.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

function withTenant<T extends Row | Row[]>(rows: T, tenantId: string): T {
  if (Array.isArray(rows)) return rows.map((r) => ({ ...r, tenant_id: tenantId })) as T;
  return { ...rows, tenant_id: tenantId } as T;
}

export async function scopedDb(explicitTenantId?: string) {
  const tenantId = await scopeTenant(explicitTenantId);
  const client = getSupabaseAdmin();

  return {
    tenantId,
    /** Raw client for the rare cross-tenant/global query. Use sparingly. */
    raw: client,
    from(table: string) {
      return {
        // Returns the builder loosely typed: wrapping it drops Supabase's row
        // generics, and every consumer in repo.ts already maps rows through
        // `(r: any)` helpers, so this matches the file's existing convention
        // rather than introducing a parallel typing scheme.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        select(columns = "*", opts?: any): any {
          return client.from(table).select(columns, opts).eq("tenant_id", tenantId);
        },
        insert(rows: Row | Row[]) {
          return client.from(table).insert(withTenant(rows, tenantId));
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        upsert(rows: Row | Row[], opts?: any) {
          return client.from(table).upsert(withTenant(rows, tenantId), opts);
        },
        update(patch: Row) {
          return client.from(table).update(patch).eq("tenant_id", tenantId);
        },
        delete() {
          return client.from(table).delete().eq("tenant_id", tenantId);
        },
      };
    },
  };
}

export type ScopedDb = Awaited<ReturnType<typeof scopedDb>>;
