"use client";

import clsx from "clsx";
import type { ButtonHTMLAttributes, ReactNode } from "react";

export type DiscoverCapitalAccent =
  | "default"
  | "emerald"
  | "blue"
  | "violet"
  | "amber"
  | "teal"
  | "cyan";

type DiscoverCapitalCardProps = {
  children: ReactNode;
  className?: string;
  accent?: DiscoverCapitalAccent;
  padding?: boolean;
  hover?: boolean;
  id?: string;
  as?: "div" | "section" | "article" | "nav" | "button";
  ariaLabel?: string;
} & Pick<ButtonHTMLAttributes<HTMLButtonElement>, "onClick" | "type" | "title">;

/** Capital-style glass card — blue glow, internal grid, premium depth. */
export function DiscoverCapitalCard({
  children,
  className,
  accent = "default",
  padding = true,
  hover = true,
  id,
  as: Tag = "div",
  ariaLabel,
  onClick,
  type = "button",
  title,
}: DiscoverCapitalCardProps) {
  const shellClass = clsx(
    "discover-capital-card relative overflow-hidden rounded-[1.25rem]",
    hover && "resolve-card-hover",
    padding && "discover-capital-card--padded",
    accent !== "default" && `discover-capital-card--${accent}`,
    className,
  );

  const inner = (
    <>
      <div aria-hidden className="discover-capital-card__grid pointer-events-none absolute inset-0" />
      <div aria-hidden className="discover-capital-card__glow pointer-events-none absolute inset-x-0 bottom-0" />
      <div className="relative">{children}</div>
    </>
  );

  if (Tag === "button") {
    return (
      <button
        id={id}
        type={type}
        title={title}
        onClick={onClick}
        className={shellClass}
      >
        {inner}
      </button>
    );
  }

  return (
    <Tag id={id} aria-label={ariaLabel} className={shellClass}>
      {inner}
    </Tag>
  );
}
