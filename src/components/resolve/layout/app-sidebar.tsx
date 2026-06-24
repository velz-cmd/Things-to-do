"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import {
  LayoutList,
  Landmark,
  ArrowRightLeft,
  Users,
  Plus,
} from "lucide-react";
import { useMissionModal } from "@/components/resolve/missions/mission-modal-context";

const NAV = [
  { href: "/missions", label: "Missions", icon: LayoutList },
  { href: "/treasury", label: "Treasury", icon: Landmark },
  { href: "/distribute", label: "Distribute", icon: ArrowRightLeft },
  { href: "/contributors", label: "Registry", icon: Users },
];

export function AppSidebar() {
  const pathname = usePathname();
  const { openModal } = useMissionModal();

  return (
    <aside className="flex h-full w-[200px] shrink-0 flex-col border-r border-resolve-border bg-resolve-bg">
      <div className="border-b border-resolve-border px-4 py-4">
        <Link href="/" className="block">
          <p className="text-sm font-semibold tracking-tight text-white">RESOLVE</p>
          <p className="text-[10px] text-resolve-muted-dim">Outcome network</p>
        </Link>
      </div>

      <div className="p-3">
        <button
          type="button"
          onClick={openModal}
          className="flex w-full items-center justify-center gap-2 rounded-md bg-resolve-accent px-3 py-2 text-xs font-semibold text-white transition hover:bg-blue-500"
        >
          <Plus className="h-3.5 w-3.5" />
          New mission
        </button>
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 px-2">
        {NAV.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] font-medium transition",
                active
                  ? "bg-resolve-hover text-white"
                  : "text-resolve-muted hover:bg-resolve-hover/60 hover:text-white"
              )}
            >
              <Icon className="h-4 w-4 shrink-0 opacity-70" strokeWidth={1.5} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-resolve-border p-3">
        <Link
          href="/merchant"
          className="block px-1 text-[10px] text-resolve-muted-dim hover:text-resolve-muted"
        >
          Merchant portal
        </Link>
      </div>
    </aside>
  );
}
