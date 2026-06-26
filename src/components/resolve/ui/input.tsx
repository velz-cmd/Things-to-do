import { forwardRef } from "react";
import clsx from "clsx";

export const Input = forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement> & { inputSize?: "sm" | "md" | "lg" }
>(function Input({ className, inputSize = "md", ...props }, ref) {
  return (
    <input
      ref={ref}
      className={clsx(
        "w-full rounded-resolve-lg border border-white/[0.08] bg-black/30 text-white",
        "placeholder:text-resolve-muted-dim",
        "transition-all duration-300",
        "focus:border-cyan-400/40 focus:bg-black/40 focus:outline-none focus:ring-2 focus:ring-cyan-400/15",
        "hover:border-white/[0.12]",
        inputSize === "sm" && "px-3.5 py-2 text-xs",
        inputSize === "md" && "px-4 py-2.5 text-sm",
        inputSize === "lg" && "px-5 py-3.5 text-sm",
        className,
      )}
      {...props}
    />
  );
});
