export function ProfileSectionSkeleton({ label }: { label: string }) {
  return (
    <section className="space-y-4 animate-pulse">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-resolve-muted-dim">
        {label}
      </p>
      <div className="h-24 rounded-xl border border-white/[0.06] bg-white/[0.03]" />
    </section>
  );
}
