"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { markGoogleAuthBroken } from "@/hooks/use-auth-capabilities";
import { toast } from "sonner";

/** Persist OAuth failures so Google button stays hidden until config is fixed. */
export function AuthErrorEffect() {
  const params = useSearchParams();

  useEffect(() => {
    const err = params.get("auth_error");
    if (!err) return;
    toast.error(decodeURIComponent(err));
    if (
      err.includes("redirect_uri_mismatch") ||
      err.includes("redirect") ||
      err.includes("OAuth")
    ) {
      markGoogleAuthBroken();
    }
  }, [params]);

  return null;
}
