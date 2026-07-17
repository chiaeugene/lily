// Whether the app is running against Supabase or the seeded in-memory store.
// Split out from repo.ts so lib/staff.ts and lib/session.ts can read it
// without creating a circular import with repo.ts.
export const isDemoMode = !process.env.NEXT_PUBLIC_SUPABASE_URL;
