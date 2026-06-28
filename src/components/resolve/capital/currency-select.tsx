"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { ChevronDown } from "lucide-react";
import type { PayoutCurrency } from "@/lib/settlement/fx";

type Option = { id: PayoutCurrency; label: string };

export function CurrencySelect({
  value,
  options,
  onChange,
}: {
  value: PayoutCurrency;
  options: Option[];
  onChange: (next: PayoutCurrency) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const current = options.find((o) => o.id === value) ?? options[0];

  if (!options.length) return null;

  return (
    <div ref={rootRef} className="relative mt-3 inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.1] bg-white/[0.03] px-3 py-1.5 text-sm text-white hover:border-resolve-accent/40"
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className="font-medium">{current?.label ?? value}</span>
        <ChevronDown
          className={clsx("h-3.5 w-3.5 text-resolve-muted transition", open && "rotate-180")}
        />
      </button>
      {open && (
        <ul
          role="listbox"
          className="absolute left-0 top-full z-20 mt-1 min-w-[8rem] overflow-hidden rounded-lg border border-resolve-border bg-[#0a0f18] py-1 shadow-xl"
        >
          {options.map((o) => (
            <li key={o.id}>
              <button
                type="button"
                role="option"
                aria-selected={o.id === value}
                className={clsx(
                  "block w-full px-3 py-2 text-left text-sm hover:bg-white/[0.06]",
                  o.id === value ? "text-resolve-accent" : "text-white",
                )}
                onClick={() => {
                  onChange(o.id);
                  setOpen(false);
                }}
              >
                {o.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
