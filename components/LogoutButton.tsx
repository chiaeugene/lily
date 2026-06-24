"use client";

import { useRouter } from "next/navigation";
import { IconLogout } from "@/components/icons";

export default function LogoutButton() {
  const router = useRouter();
  async function logout() {
    await fetch("/api/auth", { method: "DELETE" });
    router.replace("/login");
    router.refresh();
  }
  return (
    <button
      onClick={logout}
      className="mt-3 w-full inline-flex items-center gap-2 rounded-lg px-3 py-2 text-[13px] font-medium text-slate-400 hover:bg-sidebar-hover hover:text-white"
    >
      <IconLogout size={16} /> Lock / log out
    </button>
  );
}
