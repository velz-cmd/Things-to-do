import clsx from "clsx";
import { forwardRef } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "glow";
type ButtonSize = "sm" | "md" | "lg";

const variants: Record<ButtonVariant, string> = {
  primary: clsx(
    "resolve-accent-gradient resolve-btn-shine text-white",
    "border border-white/20 shadow-[0_4px_20px_rgba(92,96,159,0.35)]",
    "hover:shadow-[0_6px_28px_rgba(0,119,179,0.4)] hover:scale-[1.02] active:scale-[0.98]",
  ),
  glow: clsx(
    "resolve-accent-gradient resolve-btn-shine text-white",
    "border border-resolve-brand-periwinkle/40 shadow-[0_0_32px_rgba(125,140,196,0.35)]",
    "hover:shadow-[0_0_44px_rgba(0,119,179,0.45)] hover:scale-[1.03] active:scale-[0.98]",
  ),
  secondary: clsx(
    "border border-resolve-border-strong bg-resolve-raised text-white",
    "hover:border-resolve-brand-periwinkle/40 hover:bg-resolve-hover hover:scale-[1.01] active:scale-[0.99]",
  ),
  ghost: "text-resolve-muted hover:text-white hover:bg-white/[0.06]",
  danger:
    "border border-rose-500/30 bg-rose-500/10 text-rose-200 hover:bg-rose-500/20 hover:scale-[1.01]",
};

const sizes: Record<ButtonSize, string> = {
  sm: "px-3.5 py-2 text-xs rounded-xl",
  md: "px-5 py-2.5 text-sm rounded-resolve",
  lg: "px-7 py-3.5 text-sm rounded-resolve-lg",
};

export const Button = forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: ButtonVariant;
    size?: ButtonSize;
  }
>(function Button({ className, variant = "primary", size = "md", ...props }, ref) {
  return (
    <button
      ref={ref}
      className={clsx(
        "inline-flex items-center justify-center gap-2 font-semibold tracking-tight",
        "transition-all duration-300 ease-out",
        "disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  );
});
