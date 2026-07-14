import clsx from "clsx";
import { forwardRef } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "glow";
type ButtonSize = "sm" | "md" | "lg";

const variants: Record<ButtonVariant, string> = {
  primary: clsx(
    "resolve-accent-gradient resolve-btn-shine text-white",
    "border border-white/15 shadow-[0_6px_22px_rgba(22,135,255,0.22)]",
    "hover:brightness-110 hover:shadow-[0_8px_28px_rgba(22,135,255,0.3)] active:translate-y-px",
  ),
  glow: clsx(
    "resolve-accent-gradient resolve-btn-shine text-white",
    "border border-resolve-brand-periwinkle/40 shadow-[0_0_32px_rgba(125,140,196,0.35)]",
    "hover:shadow-[0_0_38px_rgba(22,135,255,0.36)] active:translate-y-px",
  ),
  secondary: clsx(
    "border border-resolve-border-strong bg-resolve-raised text-white",
    "hover:border-resolve-accent/40 hover:bg-resolve-hover active:translate-y-px",
  ),
  ghost: "text-resolve-muted hover:text-white hover:bg-white/[0.06]",
  danger:
    "border border-rose-500/30 bg-rose-500/10 text-rose-200 hover:bg-rose-500/20 active:translate-y-px",
};

const sizes: Record<ButtonSize, string> = {
  sm: "min-h-9 px-3.5 py-2 text-xs rounded-[10px]",
  md: "min-h-11 px-5 py-2.5 text-sm rounded-[11px]",
  lg: "min-h-12 px-7 py-3 text-sm rounded-xl",
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
        "transition-[background,border-color,box-shadow,filter,transform] duration-150 ease-out",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-resolve-accent focus-visible:ring-offset-2 focus-visible:ring-offset-[#050b15]",
        "disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  );
});
