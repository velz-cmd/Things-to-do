import clsx from "clsx";
import { forwardRef } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "glow";
type ButtonSize = "sm" | "md" | "lg";

const variants: Record<ButtonVariant, string> = {
  primary: clsx(
    "resolve-accent-gradient resolve-btn-shine text-white",
    "border border-white/15 shadow-resolve-accent",
    "hover:shadow-resolve-glow hover:scale-[1.02] active:scale-[0.98]",
  ),
  glow: clsx(
    "resolve-accent-gradient resolve-btn-shine text-white",
    "border border-resolve-accent/30 shadow-resolve-glow",
    "hover:shadow-[0_0_50px_rgba(0,122,255,0.4)] hover:scale-[1.03] active:scale-[0.98]",
  ),
  secondary: clsx(
    "resolve-glass resolve-btn-shine text-white",
    "hover:border-white/20 hover:bg-white/[0.08] hover:scale-[1.01] active:scale-[0.99]",
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
