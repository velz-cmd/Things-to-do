export default function TermsPage() {
  return (
    <div className="resolve-grid-bg min-h-screen">
      <div className="mx-auto max-w-2xl px-6 py-16 animate-resolve-enter">
        <div className="rounded-resolve-lg border border-resolve-border resolve-glass resolve-card-glow p-8 md:p-10">
          <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-resolve-muted">
            Legal
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-white">Terms of Service</h1>
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
