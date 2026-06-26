import clsx from "clsx";
import { forwardRef } from "react";

export const Input = forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement> & { inputSize?: "sm" | "md" | "lg" }
>(function Input({ className, inputSize = "md", ...props }, ref) {
  return (
    <input
      ref={ref}
      className={clsx(
        "w-full rounded-resolve border border-resolve-border-strong bg-resolve-bg/90 text-white placeholder:text-resolve-muted-dim transition focus:border-resolve-accent/60 focus:outline-none focus:ring-2 focus:ring-resolve-accent/20",
        inputSize === "sm" && "px-3 py-2 text-xs",
        inputSize === "md" && "px-3.5 py-2.5 text-sm",
        inputSize === "lg" && "px-4 py-3.5 text-sm",
        className,
      )}
      {...props}
    />
  );
});
