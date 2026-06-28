"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { Command, Search } from "lucide-react";
import { filterCommands, type CommandItem } from "@/lib/command/registry";

const GROUP_LABELS: Record<CommandItem["group"], string> = {
  navigate: "Go to",
  mission: "Start mission",
  admin: "Admin",
};

export function GlobalCommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const items = useMemo(() => filterCommands(query), [query]);

  const grouped = useMemo(() => {
    const map = new Map<CommandItem["group"], CommandItem[]>();
    for (const item of items) {
      const list = map.get(item.group) ?? [];
      list.push(item);
      map.set(item.group, list);
    }
    return map;
  }, [items]);

  const flatItems = items;

  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIndex(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  const runItem = useCallback(
    (item: CommandItem) => {
      onOpenChange(false);
      if (item.mission) {
        router.push(`/mission?mission=${encodeURIComponent(item.mission)}`);
        return;
      }
      if (item.href) router.push(item.href);
    },
    [onOpenChange, router],
  );

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onOpenChange(false);
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, flatItems.length - 1));
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
      }
      if (e.key === "Enter" && flatItems[activeIndex]) {
        e.preventDefault();
        runItem(flatItems[activeIndex]!);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, flatItems, activeIndex, onOpenChange, runItem]);

  if (!open) return null;

  let rowIndex = -1;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center bg-black/60 px-4 pt-[12vh] backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onOpenChange(false);
      }}
    >
      <div className="w-full max-w-xl overflow-hidden rounded-2xl border border-white/10 bg-[#0a1020]/95 shadow-2xl">
        <div className="flex items-center gap-2 border-b border-white/[0.08] px-4 py-3">
          <Search className="h-4 w-4 shrink-0 text-resolve-muted" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Fund React · Find gaps · Go to Capital…"
            className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-resolve-muted-dim"
          />
          <kbd className="hidden rounded border border-white/10 px-1.5 py-0.5 text-[10px] text-resolve-muted sm:inline">
            esc
          </kbd>
        </div>

        <div className="max-h-[min(420px,50vh)] overflow-y-auto p-2">
          {flatItems.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-resolve-muted">No matching commands</p>
          ) : (
            Array.from(grouped.entries()).map(([group, groupItems]) => (
              <div key={group} className="mb-2">
                <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-resolve-muted-dim">
                  {GROUP_LABELS[group]}
                </p>
                <ul>
                  {groupItems.map((item) => {
                    rowIndex += 1;
                    const idx = rowIndex;
                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          onClick={() => runItem(item)}
                          className={clsx(
                            "flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition",
                            idx === activeIndex ?
                              "bg-resolve-accent/15 text-white"
                            : "text-resolve-muted hover:bg-white/[0.04] hover:text-white",
                          )}
                        >
                          <span>{item.label}</span>
                          {item.hint && (
                            <span className="truncate text-xs text-resolve-muted-dim">{item.hint}</span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))
          )}
        </div>

        <div className="flex items-center justify-between border-t border-white/[0.06] px-4 py-2 text-[10px] text-resolve-muted-dim">
          <span className="flex items-center gap-1">
            <Command className="h-3 w-3" />
            Layer 6 — command bar
          </span>
          <span>↑↓ navigate · ↵ run</span>
        </div>
      </div>
    </div>
  );
}

export function useCommandPaletteShortcut(onOpen: () => void) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpen();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onOpen]);
}
