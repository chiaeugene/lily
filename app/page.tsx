import { redirect } from "next/navigation";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

// No marketing landing — going to "/" drops you straight at the passcode gate
// (or the dashboard if you're already signed in).
export default async function Home() {
  const authed =
    (await cookies()).get("lily_auth")?.value === (process.env.LILY_AUTH_TOKEN || "lily-authed");
  redirect(authed ? "/dashboard" : "/login");
}
