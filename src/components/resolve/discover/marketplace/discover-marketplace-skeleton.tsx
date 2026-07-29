export function DiscoverMarketplaceSkeleton() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-[1440px] px-4 py-8 sm:px-6 lg:px-8">
      <div className="h-4 w-28 animate-pulse rounded bg-white/10" />
      <div className="mt-5 h-10 w-full max-w-3xl animate-pulse rounded-xl bg-white/10" />
      <div className="mt-3 h-5 w-full max-w-xl animate-pulse rounded bg-white/[0.07]" />
      <div className="mt-8 flex gap-2 overflow-hidden">
        {[1, 2, 3, 4, 5].map((item) => (
          <div key={item} className="h-10 w-32 shrink-0 animate-pulse rounded-xl bg-white/[0.07]" />
        ))}
      </div>
      <div className="mt-6 h-12 animate-pulse rounded-2xl bg-white/[0.07]" />
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {[1, 2, 3, 4].map((item) => (
          <div key={item} className="h-64 animate-pulse rounded-2xl border border-white/[0.06] bg-white/[0.035]" />
        ))}
      </div>
    </main>
  );
}
