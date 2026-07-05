import clsx from "clsx";
import { useId } from "react";

/** Inline SVG mark — crisp at any size (no raster blur). */
export function ResolveLogoMark({
  className,
  size = 32,
}: {
  className?: string;
  size?: number;
}) {
  const uid = useId().replace(/:/g, "");
  const bgId = `resolve-logo-bg-${uid}`;
  const lineId = `resolve-logo-line-${uid}`;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      fill="none"
      width={size}
      height={size}
      className={clsx("shrink-0", className)}
      aria-hidden
    >
      <defs>
        <linearGradient id={bgId} x1="4" y1="4" x2="28" y2="28" gradientUnits="userSpaceOnUse">
          <stop stopColor="#0077B3" />
          <stop offset="0.52" stopColor="#5C609F" />
          <stop offset="1" stopColor="#7D8CC4" />
        </linearGradient>
        <linearGradient id={lineId} x1="8" y1="8" x2="24" y2="24" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ffffff" stopOpacity="0.95" />
          <stop offset="1" stopColor="#E8F1FC" stopOpacity="0.75" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill={`url(#${bgId})`} />
      <path
        d="M9.5 22.5V11.5h4.2c2.35 0 3.85 1.25 3.85 3.15 0 1.35-.7 2.35-1.95 2.85l3.1 5h-2.65l-2.75-4.55h-1.6v4.55H9.5zm2.1-6.45h2c1.15 0 1.8-.55 1.8-1.45 0-.9-.65-1.45-1.8-1.45h-2v2.9z"
        fill="white"
      />
      <circle cx="23.5" cy="10.5" r="2.25" fill="white" fillOpacity="0.95" />
      <circle cx="25.75" cy="22" r="1.75" fill="white" fillOpacity="0.85" />
      <path
        d="M23.5 12.75v4.1M23.5 16.85l2 3.5"
        stroke={`url(#${lineId})`}
        strokeWidth="1.35"
        strokeLinecap="round"
      />
    </svg>
  );
}
