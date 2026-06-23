"use client";

import { AuthHeader } from "@/components/auth/auth-header";

export function ResolveTopBar() {
  return (
    <header className="sticky top-0 z-30 flex items-center justify-end border-b border-deputy-border/80 bg-deputy-bg/80 px-4 py-3 backdrop-blur-md lg:px-8">
      <AuthHeader />
    </header>
  );
}
