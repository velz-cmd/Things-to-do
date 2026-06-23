"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { ResolveAccountMenu } from "@/components/resolve-account-menu";

const NAV = [
  { href: "/", label: "Command", icon: "⌘" },
  { href: "/missions", label: "Missions", icon: "◎" },
  { href: "/discover", label: "Discover", icon: "◈" },
  { href: "/proof", label: "Proof", icon: "✓" },
  { href: "/vault", label: "Vault", icon: "◇" },
  { href: "/settlement", label: "Settlement", icon: "⬡" },
  { href: "/approvals", label: "Approvals", icon: "!" },
];

export function ResolveSidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-52 shrink-0 flex-col border-r border-deputy-border bg-deputy-panel/50 p-3">
      <div className="mb-6 px-1">
        <p className="text-lg font-semibold tracking-tight">RESOLVE</p>
        <p className="text-[10px] uppercase tracking-[0.2em] text-deputy-muted">
          Outcome engine
        </p>
      </div>

      <nav className="flex flex-1 flex-col gap-0.5">
        {NAV.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition",
                active
                  ? "bg-blue-600/20 text-blue-300"
                  : "text-deputy-muted hover:bg-deputy-bg hover:text-white"
              )}
            >
              <span className="w-4 text-center text-xs opacity-70">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto space-y-2 border-t border-deputy-border pt-3">
        <Link
          href="/merchant"
          className="block px-1 text-[10px] text-deputy-muted underline hover:text-blue-400"
        >
          Merchant portal (demo)
        </Link>
        <ResolveAccountMenu compact />
      </div>
    </aside>
  );
}
