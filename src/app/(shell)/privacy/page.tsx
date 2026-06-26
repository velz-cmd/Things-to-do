export default function PrivacyPage() {
  return (
    <div className="relative min-h-screen">
      <div className="mx-auto max-w-2xl px-6 py-20 animate-resolve-enter">
        <div className="resolve-border-gradient overflow-hidden rounded-resolve-xl resolve-glass resolve-card-glow p-10">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-400/80">
            Legal
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white">Privacy Policy</h1>
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
