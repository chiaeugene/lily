import { isDemoMode } from "./env";
import { getSupabaseAdmin } from "./supabase";
import { hashPassword, verifyPassword } from "./password";

export type UserRole = "super_admin" | "owner" | "staff";

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  cascadeEnabled: boolean;
  active: boolean;
  createdAt: string;
}

export interface User {
  id: string;
  tenantId: string | null; // null only for a super_admin not pinned to a tenant
  email: string;
  name: string;
  role: UserRole;
  active: boolean;
  mustChangePassword: boolean;
}

export const TIEN_NGAI_TENANT_ID = "tien-ngai";

// ── Demo-mode stores (globalThis so they survive dev HMR reloads) ────────────
const g = globalThis as unknown as {
  __lilyTenants?: Tenant[];
  __lilyUsers?: (User & { passwordHash: string })[];
};
const DEMO_TENANTS: Tenant[] =
  g.__lilyTenants ??
  (g.__lilyTenants = [
    {
      id: TIEN_NGAI_TENANT_ID,
      name: "Tien Ngai Machinery Group",
      slug: "tien-ngai",
      cascadeEnabled: true,
      active: true,
      createdAt: new Date(0).toISOString(),
    },
  ]);
const DEMO_USERS: (User & { passwordHash: string })[] = g.__lilyUsers ?? (g.__lilyUsers = []);

// ── Bootstrap ────────────────────────────────────────────────────────────────
// Creates the platform's first super-admin from env vars, if no users exist.
// Credentials live in env (never in the repo), so nothing sensitive is
// committed. Safe to call on every login attempt — it no-ops once a user
// exists. Returns false when the env vars aren't configured.
export async function ensureBootstrapAdmin(): Promise<boolean> {
  const email = (process.env.LILY_ADMIN_EMAIL || "").trim().toLowerCase();
  const password = process.env.LILY_ADMIN_PASSWORD || "";
  if (!email || !password) return false;

  const existing = await countUsers();
  if (existing > 0) return true;

  await createUser({
    email,
    password,
    name: "Platform Admin",
    role: "super_admin",
    tenantId: TIEN_NGAI_TENANT_ID,
    // 123456-class passwords are fine for a demo but must not survive contact
    // with a real customer's books — surface that in the UI after login.
    mustChangePassword: password.length < 10,
  });
  return true;
}

async function countUsers(): Promise<number> {
  if (isDemoMode) return DEMO_USERS.length;
  const { count } = await getSupabaseAdmin().from("users").select("*", { count: "exact", head: true });
  return count ?? 0;
}

// ── Users ────────────────────────────────────────────────────────────────────

export async function createUser(input: {
  email: string;
  password: string;
  name: string;
  role: UserRole;
  tenantId: string | null;
  mustChangePassword?: boolean;
}): Promise<User> {
  const passwordHash = await hashPassword(input.password);
  const email = input.email.trim().toLowerCase();

  if (isDemoMode) {
    const user: User & { passwordHash: string } = {
      id: `usr-${Date.now().toString(36)}`,
      tenantId: input.tenantId,
      email,
      name: input.name,
      role: input.role,
      active: true,
      mustChangePassword: input.mustChangePassword ?? false,
      passwordHash,
    };
    DEMO_USERS.push(user);
    return stripHash(user);
  }

  const { data, error } = await getSupabaseAdmin()
    .from("users")
    .insert({
      tenant_id: input.tenantId,
      email,
      password_hash: passwordHash,
      name: input.name,
      role: input.role,
      must_change_password: input.mustChangePassword ?? false,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return rowToUser(data);
}

export async function authenticate(email: string, password: string): Promise<User | null> {
  const needle = email.trim().toLowerCase();

  if (isDemoMode) {
    const u = DEMO_USERS.find((x) => x.email === needle && x.active);
    if (!u) return null;
    return (await verifyPassword(password, u.passwordHash)) ? stripHash(u) : null;
  }

  const { data } = await getSupabaseAdmin()
    .from("users")
    .select("*")
    .eq("email", needle)
    .eq("active", true)
    .maybeSingle();
  if (!data) return null;
  return (await verifyPassword(password, data.password_hash)) ? rowToUser(data) : null;
}

export async function getUserById(id: string): Promise<User | null> {
  if (isDemoMode) {
    const u = DEMO_USERS.find((x) => x.id === id);
    return u ? stripHash(u) : null;
  }
  const { data } = await getSupabaseAdmin().from("users").select("*").eq("id", id).maybeSingle();
  return data ? rowToUser(data) : null;
}

export async function listUsers(tenantId: string): Promise<User[]> {
  if (isDemoMode) return DEMO_USERS.filter((u) => u.tenantId === tenantId).map(stripHash);
  const { data } = await getSupabaseAdmin().from("users").select("*").eq("tenant_id", tenantId).order("name");
  return (data ?? []).map(rowToUser);
}

export async function setUserPassword(id: string, password: string): Promise<void> {
  const passwordHash = await hashPassword(password);
  if (isDemoMode) {
    const u = DEMO_USERS.find((x) => x.id === id);
    if (u) {
      u.passwordHash = passwordHash;
      u.mustChangePassword = false;
    }
    return;
  }
  await getSupabaseAdmin()
    .from("users")
    .update({ password_hash: passwordHash, must_change_password: false })
    .eq("id", id);
}

export async function setUserActive(id: string, active: boolean): Promise<void> {
  if (isDemoMode) {
    const u = DEMO_USERS.find((x) => x.id === id);
    if (u) u.active = active;
    return;
  }
  await getSupabaseAdmin().from("users").update({ active }).eq("id", id);
}

// ── Tenants ──────────────────────────────────────────────────────────────────

export async function getTenant(id: string): Promise<Tenant | null> {
  if (isDemoMode) return DEMO_TENANTS.find((t) => t.id === id) ?? null;
  const { data } = await getSupabaseAdmin().from("tenants").select("*").eq("id", id).maybeSingle();
  return data ? rowToTenant(data) : null;
}

export async function listTenants(): Promise<Tenant[]> {
  if (isDemoMode) return DEMO_TENANTS;
  const { data } = await getSupabaseAdmin().from("tenants").select("*").order("name");
  return (data ?? []).map(rowToTenant);
}

export async function createTenant(input: { name: string; slug: string }): Promise<Tenant> {
  const tenant: Tenant = {
    id: input.slug,
    name: input.name,
    slug: input.slug,
    // Only the Tien Ngai group runs the 3-invoice cascade; new tenants get
    // ordinary single-company invoicing.
    cascadeEnabled: false,
    active: true,
    createdAt: new Date().toISOString(),
  };
  if (isDemoMode) {
    DEMO_TENANTS.push(tenant);
    return tenant;
  }
  const { data, error } = await getSupabaseAdmin()
    .from("tenants")
    .insert({ id: tenant.id, name: tenant.name, slug: tenant.slug, cascade_enabled: false })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return rowToTenant(data);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToUser(r: any): User {
  return {
    id: r.id,
    tenantId: r.tenant_id ?? null,
    email: r.email,
    name: r.name,
    role: r.role as UserRole,
    active: r.active,
    mustChangePassword: r.must_change_password ?? false,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToTenant(r: any): Tenant {
  return {
    id: r.id,
    name: r.name,
    slug: r.slug,
    cascadeEnabled: r.cascade_enabled ?? false,
    active: r.active ?? true,
    createdAt: r.created_at,
  };
}

function stripHash(u: User & { passwordHash: string }): User {
  const { passwordHash: _ignored, ...rest } = u;
  void _ignored;
  return rest;
}
