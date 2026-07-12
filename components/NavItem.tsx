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
      className={`relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13.5px] font-medium transition-colors ${
        active ? "bg-primary-soft text-primary-hover" : "text-muted hover:bg-surface-2 hover:text-ink"
      }`}
    >
      {icon}
      <span>{label}</span>
      {badge > 0 && (
        <span className="ml-auto bg-primary text-white text-[10px] font-bold rounded-full min-w-5 h-5 px-1.5 grid place-items-center font-mono">
          {badge}
        </span>
      )}
    </Link>
  );
}
