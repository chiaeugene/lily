import { repo, isDemoMode } from "@/lib/repo";
import { LilyLogo } from "@/components/Logo";
import NavItem from "@/components/NavItem";
import LogoutButton from "@/components/LogoutButton";
import MobileNav from "@/components/MobileNav";
import {
  IconDashboard,
  IconSearch,
  IconChart,
  IconArchive,
  IconSettings,
  IconQuote,
  IconBox,
} from "@/components/icons";

const NAV = [
  { href: "/dashboard",  label: "Dashboard",     Icon: IconDashboard },
  { href: "/quotation",  label: "Quotation",      Icon: IconQuote },
  { href: "/po",         label: "Purchase Orders", Icon: IconBox },
  { href: "/search",     label: "Search",         Icon: IconSearch },
  { href: "/analysis",   label: "Sales Analysis", Icon: IconChart },
  { href: "/records",    label: "Records",        Icon: IconArchive },
  { href: "/settings",   label: "Settings",       Icon: IconSettings },
];

export default async function Shell({ children }: { children: React.ReactNode }) {
  const pending = (await repo.listPendingOrders()).length;
  return (
    <div className="min-h-dvh flex">
      {/* Warm aurora — clipped so it doesn't extend past the viewport */}
      <div className="fixed inset-0 -z-10 pointer-events-none no-print overflow-hidden" aria-hidden="true">
        <div className="aurora aurora--masked" />
      </div>

      {/* Desktop sidebar — hidden on mobile */}
      <aside className="hidden md:flex w-64 shrink-0 bg-sidebar text-slate-300 flex-col no-print sticky top-0 h-screen">
        <div className="px-5 h-16 flex items-center border-b border-white/[0.06]">
          <LilyLogo />
        </div>
        <nav className="flex-1 py-4 px-3 space-y-0.5 overflow-y-auto">
          {NAV.map((n) => (
            <NavItem
              key={n.href}
              href={n.href}
              label={n.label}
              icon={<n.Icon size={18} />}
              badge={n.href === "/dashboard" ? pending : 0}
            />
          ))}
        </nav>
        <div className="px-5 py-4 border-t border-white/[0.06]">
          <div className="flex items-center gap-2 text-[11px]">
            <span className={`h-1.5 w-1.5 rounded-full ${isDemoMode ? "bg-warn" : "bg-profit"}`} />
            <span className="text-slate-400">{isDemoMode ? "Demo mode" : "Live · Supabase"}</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1.5">Tien Ngai → Prim → 3C</div>
          <LogoutButton />
        </div>
      </aside>

      {/* Mobile nav: hamburger button + slide-in drawer */}
      <MobileNav pending={pending} demoMode={isDemoMode} />

      {/* Main content — pad top on mobile to clear the fixed hamburger bar */}
      <main className="flex-1 min-w-0 flex flex-col">{children}</main>
    </div>
  );
}
