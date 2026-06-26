"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import NavItem from "@/components/NavItem";
import LogoutButton from "@/components/LogoutButton";
import { LilyLogo } from "@/components/Logo";
import {
  IconDashboard,
  IconSearch,
  IconChart,
  IconArchive,
  IconSettings,
  IconQuote,
} from "@/components/icons";

const NAV = [
  { href: "/dashboard",  label: "Dashboard",     Icon: IconDashboard },
  { href: "/quotation",  label: "Quotation",      Icon: IconQuote },
  { href: "/search",     label: "Search",         Icon: IconSearch },
  { href: "/analysis",   label: "Sales Analysis", Icon: IconChart },
  { href: "/records",    label: "Records",        Icon: IconArchive },
  { href: "/settings",   label: "Settings",       Icon: IconSettings },
];

export default function MobileNav({
  pending,
  demoMode,
}: {
  pending: number;
  demoMode: boolean;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Close drawer on route change
  useEffect(() => { setOpen(false); }, [pathname]);

  return (
    <>
      {/* Hamburger button — sits over the left side of the sticky PageHeader */}
      <button
        onClick={() => setOpen(true)}
        className="md:hidden fixed top-0 left-0 z-40 h-16 w-16 flex items-center justify-center
          text-slate-400 hover:text-white bg-sidebar border-b border-r border-white/[0.06]
          transition-colors duration-150"
        aria-label="Open navigation"
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path
            d="M3 5.5h14M3 10h14M3 14.5h14"
            stroke="currentColor"
            strokeWidth="1.65"
            strokeLinecap="round"
          />
        </svg>
      </button>

      {/* Backdrop */}
      {open && (
        <div
          className="md:hidden fixed inset-0 z-50 bg-ink/60 backdrop-blur-sm"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Slide-in drawer */}
      <aside
        className={`md:hidden fixed inset-y-0 left-0 z-50 w-72 bg-sidebar text-slate-300
          flex flex-col shadow-2xl transition-transform duration-300 ease-out
          ${open ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="px-5 h-16 flex items-center justify-between border-b border-white/[0.06] shrink-0">
          <LilyLogo />
          <button
            onClick={() => setOpen(false)}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-white/5 transition-colors"
            aria-label="Close navigation"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
              <path
                d="M4 4l10 10M14 4L4 14"
                stroke="currentColor"
                strokeWidth="1.65"
                strokeLinecap="round"
              />
            </svg>
          </button>
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

        <div className="px-5 py-4 border-t border-white/[0.06] shrink-0">
          <div className="flex items-center gap-2 text-[11px]">
            <span className={`h-1.5 w-1.5 rounded-full ${demoMode ? "bg-warn" : "bg-profit"}`} />
            <span className="text-slate-400">{demoMode ? "Demo mode" : "Live · Supabase"}</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1.5">Tien Ngai → Prim → 3C</div>
          <LogoutButton />
        </div>
      </aside>
    </>
  );
}
