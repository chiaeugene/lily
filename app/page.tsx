import Link from "next/link";
import { cookies } from "next/headers";
import { AuroraBackground } from "@/components/ui/aurora-background";
import { LilyLogo, LilyMark } from "@/components/Logo";
import LandingScroll from "@/components/LandingScroll";
import { IconArrowRight } from "@/components/icons";

export const dynamic = "force-dynamic";

export default async function LandingPage() {
  const authed = (await cookies()).get("lily_auth")?.value === (process.env.LILY_AUTH_TOKEN || "lily-authed");
  const cta = authed ? "/dashboard" : "/login";

  return (
    <div className="bg-white">
      {/* Hero with aurora */}
      <AuroraBackground showRadialGradient className="min-h-dvh">
        <div className="absolute top-0 inset-x-0 flex items-center justify-between px-6 md:px-10 h-16">
          <div className="rounded-lg bg-sidebar/95 px-3 py-2">
            <LilyLogo subtitle={false} />
          </div>
          <Link
            href={cta}
            className="inline-flex items-center gap-1.5 rounded-lg bg-ink text-white text-sm font-medium px-4 py-2 hover:bg-ink/90"
          >
            {authed ? "Open app" : "Sign in"} <IconArrowRight size={15} />
          </Link>
        </div>

        <div className="mx-auto max-w-3xl text-center px-4">
          <div className="flex justify-center mb-5">
            <LilyMark size={56} />
          </div>
          <h1 className="text-4xl md:text-6xl font-semibold tracking-tight text-ink">
            Lily — your 24/7 back-office
          </h1>
          <p className="mt-5 text-lg text-muted max-w-xl mx-auto">
            Place a thermal-paper order in Telegram. Lily verifies it and generates the full
            invoice cascade — Tien Ngai → Prim → 3C → customer — in one click.
          </p>
          <div className="mt-8 flex items-center justify-center gap-3">
            <Link
              href={cta}
              className="inline-flex items-center gap-2 rounded-xl bg-primary hover:bg-primary-hover text-white text-sm font-semibold px-6 py-3 shadow-[0_10px_30px_rgba(79,70,229,0.35)]"
            >
              {authed ? "Open dashboard" : "Enter passcode"} <IconArrowRight size={16} />
            </Link>
          </div>
          <p className="mt-10 text-[12px] uppercase tracking-widest text-muted/70">
            Tien Ngai Machinery · Prim Paper · 3C Industries
          </p>
        </div>
      </AuroraBackground>

      {/* Scroll-animation hero */}
      <div className="-mt-24 overflow-hidden pb-24">
        <LandingScroll />
      </div>
    </div>
  );
}
