"use client";

import { useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { toast } from "sonner";

export function SignInModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { signInWithGoogle, signInWithEmail } = useAuth();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState<"google" | "email" | null>(null);

  if (!open) return null;

  async function handleGoogle() {
    setLoading("google");
    try {
      await signInWithGoogle();
    } finally {
      setLoading(null);
    }
  }

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) {
      toast.error("Enter your email");
      return;
    }
    setLoading("email");
    try {
      await signInWithEmail(email.trim());
      onClose();
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-md rounded-2xl border border-deputy-border bg-deputy-panel p-6">
        <h2 className="text-lg font-semibold">Welcome to RESOLVE</h2>
        <p className="mt-1 text-sm text-deputy-muted">
          No crypto knowledge required. We create a secure wallet for you.
        </p>

        <button
          type="button"
          disabled={loading !== null}
          onClick={handleGoogle}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl border border-deputy-border bg-white py-3 text-sm font-medium text-gray-900 disabled:opacity-50"
        >
          {loading === "google" ? "Redirecting…" : "Continue with Google"}
        </button>

        <div className="my-4 flex items-center gap-3 text-xs text-deputy-muted">
          <span className="h-px flex-1 bg-deputy-border" />
          or email
          <span className="h-px flex-1 bg-deputy-border" />
        </div>

        <form onSubmit={handleEmail} className="space-y-3">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            className="w-full rounded-xl border border-deputy-border bg-deputy-bg px-4 py-3 text-sm outline-none focus:border-deputy-accent/50"
          />
          <button
            type="submit"
            disabled={loading !== null}
            className="w-full rounded-xl bg-deputy-accent py-3 text-sm font-semibold text-deputy-bg disabled:opacity-50"
          >
            {loading === "email" ? "Sending link…" : "Email me a sign-in link"}
          </button>
        </form>

        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full text-center text-xs text-deputy-muted underline"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
