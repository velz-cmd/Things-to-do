import clsx from "clsx";
import { forwardRef } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

const variants: Record<ButtonVariant, string> = {
  primary:
    "resolve-accent-gradient text-white shadow-resolve-accent hover:brightness-110 border border-white/10",
  secondary:
    "border border-resolve-border-strong bg-resolve-raised/80 text-white hover:bg-resolve-hover hover:border-white/15",
  ghost: "text-resolve-muted hover:text-white hover:bg-resolve-hover/60",
  danger: "border border-rose-500/30 bg-rose-500/10 text-rose-200 hover:bg-rose-500/20",
};

const sizes: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-xs rounded-lg",
  md: "px-4 py-2.5 text-sm rounded-resolve",
  lg: "px-6 py-3 text-sm rounded-resolve",
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
        "inline-flex items-center justify-center gap-2 font-semibold transition disabled:cursor-not-allowed disabled:opacity-50",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  );
});
