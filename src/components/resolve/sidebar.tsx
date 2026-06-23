"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { WalletConnect } from "@/components/wallet-connect";

const NAV = [
  { href: "/", label: "Overview", icon: "◉" },
  { href: "/tasks", label: "Tasks", icon: "◎" },
  { href: "/vault", label: "Vault", icon: "◇" },
];

export function ResolveSidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-56 shrink-0 flex-col border-r border-deputy-border bg-deputy-panel/50 p-4">
      <div className="mb-8">
        <p className="text-lg font-semibold tracking-tight">RESOLVE</p>
        <p className="text-[10px] uppercase tracking-[0.2em] text-deputy-muted">
          Digital chief of staff
        </p>
      </div>

      <nav className="flex flex-1 flex-col gap-1">
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
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition",
                active
                  ? "bg-deputy-accent/15 text-deputy-accent"
                  : "text-deputy-muted hover:bg-deputy-bg hover:text-white"
              )}
            >
              <span className="text-xs opacity-70">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto space-y-3 border-t border-deputy-border pt-4">
        <WalletConnect compact />
        <p className="text-[10px] text-deputy-muted">Pay only on proof</p>
      </div>
    </aside>
  );
}
