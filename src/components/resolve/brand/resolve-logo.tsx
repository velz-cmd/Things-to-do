"use client";

import Image from "next/image";
import Link from "next/link";
import clsx from "clsx";
import { useState } from "react";
import { BRAND_LOGO_PATH } from "@/lib/brand/assets";

type ResolveLogoProps = {
  className?: string;
  /** Nav bar — compact height */
  size?: "nav" | "signin";
};

function ResolveLogoFallback({ className }: { className?: string }) {
  return (
    <span
      className={clsx(
        "inline-flex h-8 w-8 items-center justify-center rounded-xl resolve-accent-gradient shadow-resolve-glow",
        className,
      )}
    >
      <span className="text-xs font-bold text-white">R</span>
    </span>
  );
}

export function ResolveLogo({ className, size = "nav" }: ResolveLogoProps) {
  const [broken, setBroken] = useState(false);
  const height = size === "signin" ? 40 : 32;
  const width = size === "signin" ? 160 : 128;

  return (
    <Link href="/" className={clsx("group inline-flex items-center gap-2.5", className)}>
      {broken ? (
        <>
          <ResolveLogoFallback className="transition group-hover:scale-105" />
          <span className="text-sm font-semibold tracking-[0.08em] text-white">RESOLVE</span>
        </>
      ) : (
        <Image
          src={BRAND_LOGO_PATH}
          alt="RESOLVE"
          width={width}
          height={height}
          priority
          className={clsx(
            "w-auto object-contain object-left transition group-hover:opacity-95",
            size === "signin" ? "h-10" : "h-8",
          )}
          onError={() => setBroken(true)}
        />
      )}
    </Link>
  );
}
