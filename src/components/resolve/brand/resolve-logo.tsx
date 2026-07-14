"use client";

import Image from "next/image";
import Link from "next/link";
import clsx from "clsx";
import { useState } from "react";
import { BRAND_LOGO_PATH } from "@/lib/brand/assets";

type ResolveLogoProps = {
  className?: string;
  size?: "nav" | "signin";
  wordmark?: boolean;
};

function ResolveLogoFallback({ className, size = "nav" }: { className?: string; size?: "nav" | "signin" }) {
  const box = size === "signin" ? "h-14 w-14" : "h-12 w-12";
  return (
    <span
      className={clsx(
        "inline-flex items-center justify-center rounded-xl resolve-accent-gradient shadow-resolve-glow",
        box,
        className,
      )}
    >
      <span className={size === "signin" ? "text-sm font-bold text-white" : "text-xs font-bold text-white"}>
        R
      </span>
    </span>
  );
}

export function ResolveLogo({ className, size = "nav", wordmark = false }: ResolveLogoProps) {
  const [broken, setBroken] = useState(false);
  const dim = size === "signin" ? 56 : 48;

  return (
    <Link href="/" className={clsx("group inline-flex items-center gap-2.5", className)}>
      {broken ? (
        <>
          <ResolveLogoFallback size={size} className="transition group-hover:scale-105" />
          <span className="text-sm font-semibold tracking-[0.08em] text-white">RESOLVE</span>
        </>
      ) : (
        <Image
          src={BRAND_LOGO_PATH}
          alt="RESOLVE"
          width={dim}
          height={dim}
          priority
          className={clsx(
            "shrink-0 rounded-lg object-contain transition group-hover:opacity-95",
            size === "signin" ? "h-14 w-14" : "h-12 w-12",
          )}
          onError={() => setBroken(true)}
        />
      )}
      {!broken && wordmark && (
        <span className="hidden text-[13px] font-semibold tracking-[0.16em] text-white sm:inline">
          RESOLVE
        </span>
      )}
    </Link>
  );
}
