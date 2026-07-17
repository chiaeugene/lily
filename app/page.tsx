import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { verifySessionCookie } from "@/lib/session";

export const dynamic = "force-dynamic";

// No marketing landing — going to "/" drops you straight at the passcode gate
// (or the dashboard if you're already signed in).
export default async function Home() {
  const staffId = await verifySessionCookie((await cookies()).get("lily_auth")?.value);
  redirect(staffId ? "/dashboard" : "/login");
}
