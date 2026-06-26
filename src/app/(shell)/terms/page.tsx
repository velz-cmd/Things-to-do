export default function TermsPage() {
  return (
    <div className="relative min-h-screen">
      <div className="mx-auto max-w-2xl px-6 py-20 animate-resolve-enter">
        <div className="resolve-border-gradient overflow-hidden rounded-resolve-xl resolve-glass resolve-card-glow p-10">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-400/80">
            Legal
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white">Terms of Service</h1>
          <p className="mt-6 text-sm leading-relaxed text-resolve-muted">
            RESOLVE terms are being finalized for the preview release. By using this application you
            agree to use it responsibly and only connect wallets and accounts you control.
          </p>
          <p className="mt-4 text-sm leading-relaxed text-resolve-muted">
            Settlement features involve real digital assets. You are responsible for verifying
            authorizations before claiming or distributing funds.
          </p>
        </div>
      </div>
    </div>
  );
}
