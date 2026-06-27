"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import {
  LayoutGrid,
  Landmark,
  Activity,
  SlidersHorizontal,
  Radio,
} from "lucide-react";

const ITEMS = [
  { href: "/workspace", label: "Command", icon: LayoutGrid, exact: true },
  { href: "/payments", label: "Capital", icon: Landmark, exact: false },
  { href: "/activity", label: "Network feed", icon: Activity, exact: false },
  { href: "/workspace/fund", label: "Allocate", icon: SlidersHorizontal, exact: false },
] as const;

export function WorkspaceSidebar({ onManual }: { onManual?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="flex h-full w-52 shrink-0 flex-col border-r border-resolve-border bg-resolve-bg-deep/20 py-4">
      <p className="px-4 text-[10px] font-semibold uppercase tracking-[0.14em] text-resolve-muted-dim">
        Workspace
      </p>
      <ul className="mt-3 flex-1 space-y-0.5 px-2">
        {ITEMS.map((item) => {
          const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={clsx(
                  "flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition",
                  active
                    ? "bg-resolve-accent/15 text-white"
                    : "text-resolve-muted hover:bg-resolve-hover/30 hover:text-white",
                )}
              >
                <Icon className="h-4 w-4 shrink-0" strokeWidth={1.5} />
                {item.label}
              </Link>
            </li>
          );
        })}
        {onManual && (
          <li>
            <button
              type="button"
              onClick={onManual}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium text-resolve-muted transition hover:bg-resolve-hover/30 hover:text-white"
            >
              <SlidersHorizontal className="h-4 w-4" strokeWidth={1.5} />
              Policies
            </button>
          </li>
        )}
      </ul>
      <div className="border-t border-resolve-border px-4 pt-4">
        <p className="flex items-center gap-1.5 text-[10px] text-resolve-muted-dim">
          <Radio className="h-3 w-3" />
          Sensors run in background
        </p>
        <Link href="/profile" className="mt-2 block text-[11px] text-resolve-accent hover:underline">
          Identity & sources →
        </Link>
      </div>
    </nav>
  );
}
