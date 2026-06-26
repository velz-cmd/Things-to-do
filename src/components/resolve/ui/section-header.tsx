import clsx from "clsx";
import type { LucideIcon } from "lucide-react";

export function SectionHeader({
  title,
  description,
  icon: Icon,
  action,
  className,
}: {
  title: string;
  description?: string;
  icon?: LucideIcon;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={clsx("flex flex-wrap items-end justify-between gap-3", className)}>
      <div className="flex items-start gap-2.5">
        {Icon && (
          <div className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-lg border border-resolve-border bg-resolve-raised/80">
            <Icon className="h-3.5 w-3.5 text-resolve-accent" strokeWidth={1.5} />
          </div>
        )}
        <div>
          <h2 className="text-sm font-semibold text-white">{title}</h2>
          {description && (
            <p className="mt-0.5 text-xs text-resolve-muted">{description}</p>
          )}
        </div>
      </div>
      {action}
    </div>
  );
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-resolve-muted-dim">
      {children}
    </p>
  );
}
