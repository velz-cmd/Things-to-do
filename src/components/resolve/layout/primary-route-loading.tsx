import { LoaderCircle } from "lucide-react";

export function PrimaryRouteLoading({ label = "Loading workspace" }: { label?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="primary-route-loading"
      className="mx-auto w-full max-w-[1440px] px-4 py-7 sm:px-6 lg:px-8"
    >
      <div className="flex min-h-14 items-center gap-3 rounded-xl border border-white/[0.08] bg-[#07101f]/85 px-4 text-xs text-resolve-muted shadow-[0_12px_34px_rgba(0,0,0,.18)]">
        <LoaderCircle className="h-4 w-4 animate-spin text-resolve-accent" aria-hidden="true" />
        <span>{label}</span>
      </div>
      <div className="mt-4 grid gap-3 lg:grid-cols-3" aria-hidden="true">
        <div className="h-24 animate-pulse rounded-xl border border-white/[0.06] bg-white/[0.025]" />
        <div className="h-24 animate-pulse rounded-xl border border-white/[0.06] bg-white/[0.025]" />
        <div className="h-24 animate-pulse rounded-xl border border-white/[0.06] bg-white/[0.025]" />
      </div>
    </div>
  );
}
