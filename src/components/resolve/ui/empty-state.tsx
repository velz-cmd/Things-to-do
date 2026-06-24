import type { LucideIcon } from "lucide-react";
import clsx from "clsx";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={clsx(
        "flex flex-col items-center justify-center rounded-lg border border-dashed border-resolve-border-strong bg-resolve-raised/50 px-6 py-14 text-center",
        className
      )}
    >
      {Icon && (
        <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg border border-resolve-border-strong bg-resolve-hover">
          <Icon className="h-5 w-5 text-resolve-muted" strokeWidth={1.5} />
        </div>
      )}
      <p className="text-sm font-medium text-white">{title}</p>
      {description && (
        <p className="mt-1 max-w-sm text-sm text-resolve-muted">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
