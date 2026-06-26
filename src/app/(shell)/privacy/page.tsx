export default function PrivacyPage() {
  return (
    <div className="resolve-grid-bg min-h-screen">
      <div className="mx-auto max-w-2xl px-6 py-16 animate-resolve-enter">
        <div className="rounded-resolve-lg border border-resolve-border resolve-glass resolve-card-glow p-8 md:p-10">
          <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-resolve-muted">
            Legal
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-white">Privacy Policy</h1>
          <p className="mt-6 text-sm leading-relaxed text-resolve-muted">
            RESOLVE processes email, wallet, and connector data only to run attribution and
            settlement for your account. Gmail access is optional and separate from sign-in.
          </p>
          <p className="mt-4 text-sm leading-relaxed text-resolve-muted">
            Contact the team for data deletion requests. We do not sell personal data.
          </p>
        </div>
      </div>
    </div>
  );
}
