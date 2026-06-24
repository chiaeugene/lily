"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function NavItem({
  href,
  label,
  icon,
  badge = 0,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
  badge?: number;
}) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(href + "/");
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium ${
        active ? "bg-sidebar-active text-white" : "text-slate-400 hover:bg-sidebar-hover hover:text-slate-100"
      }`}
    >
      {active && <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full bg-brand" />}
      <span className={active ? "text-brand" : ""}>{icon}</span>
      <span>{label}</span>
      {badge > 0 && (
        <span className="ml-auto bg-loss text-white text-[11px] font-semibold rounded-full min-w-5 h-5 px-1.5 grid place-items-center">
          {badge}
        </span>
      )}
    </Link>
  );
}
