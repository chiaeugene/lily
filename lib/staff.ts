import { cookies } from "next/headers";
import { isDemoMode } from "./env";
import { getSupabaseAdmin } from "./supabase";
import { verifySessionCookie } from "./session";

export type Staff = { id: string; name: string; passcode: string; active: boolean };

const AUTH_COOKIE = "lily_auth";

// Held on globalThis so edits persist across dev HMR reloads (same pattern as lib/companies.ts).
const g = globalThis as unknown as { __lilyStaff?: Staff[] };
const DEMO_STAFF: Staff[] =
  g.__lilyStaff ??
  (g.__lilyStaff = [
    { id: "s1", name: "Owner", passcode: process.env.LILY_PASSCODE || "870333", active: true },
  ]);

export async function findStaffByPasscode(code: string): Promise<Staff | null> {
  if (!code) return null;
  if (isDemoMode) return DEMO_STAFF.find((s) => s.active && s.passcode === code) ?? null;
  const { data } = await getSupabaseAdmin()
    .from("staff")
    .select("*")
    .eq("passcode", code)
    .eq("active", true)
    .maybeSingle();
  return data ? { id: data.id, name: data.name, passcode: data.passcode, active: data.active } : null;
}

export async function getStaffById(id: string): Promise<Staff | null> {
  if (isDemoMode) return DEMO_STAFF.find((s) => s.id === id) ?? null;
  const { data } = await getSupabaseAdmin().from("staff").select("*").eq("id", id).maybeSingle();
  return data ? { id: data.id, name: data.name, passcode: data.passcode, active: data.active } : null;
}

export async function listStaff(): Promise<Staff[]> {
  if (isDemoMode) return DEMO_STAFF;
  const { data } = await getSupabaseAdmin().from("staff").select("*").order("name");
  return data ?? [];
}

export async function addStaff(name: string, passcode: string): Promise<Staff> {
  if (isDemoMode) {
    const s: Staff = { id: `s${DEMO_STAFF.length + 1}`, name, passcode, active: true };
    DEMO_STAFF.push(s);
    return s;
  }
  const { data, error } = await getSupabaseAdmin().from("staff").insert({ name, passcode }).select().single();
  if (error) throw new Error(error.message);
  return data;
}

export async function setStaffActive(id: string, active: boolean): Promise<void> {
  if (isDemoMode) {
    const s = DEMO_STAFF.find((x) => x.id === id);
    if (s) s.active = active;
    return;
  }
  await getSupabaseAdmin().from("staff").update({ active }).eq("id", id);
}

// Reads + verifies the session cookie for the current request (server
// components / route handlers only). Returns the signed-in staff member's
// name, or "unknown" if the cookie is missing/invalid/stale.
export async function getCurrentActor(): Promise<string> {
  const raw = (await cookies()).get(AUTH_COOKIE)?.value;
  const staffId = await verifySessionCookie(raw);
  if (!staffId) return "unknown";
  const staff = await getStaffById(staffId);
  return staff?.name ?? "unknown";
}
