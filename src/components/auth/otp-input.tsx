"use client";

import { useCallback, useEffect, useRef } from "react";
import clsx from "clsx";

type OtpInputProps = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  error?: boolean;
};

const LENGTH = 6;

export function OtpInput({ value, onChange, disabled, error }: OtpInputProps) {
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);
  const digits = value.padEnd(LENGTH, " ").slice(0, LENGTH).split("");

  const focusIndex = useCallback((index: number) => {
    inputsRef.current[index]?.focus();
    inputsRef.current[index]?.select();
  }, []);

  useEffect(() => {
    if (value.length === 0) focusIndex(0);
  }, [value.length, focusIndex]);

  function applyDigits(next: string[]) {
    onChange(next.join("").replace(/\s/g, "").slice(0, LENGTH));
  }

  function handleChange(index: number, char: string) {
    const digit = char.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[index] = digit || " ";
    applyDigits(next);
    if (digit && index < LENGTH - 1) focusIndex(index + 1);
  }

  function handleKeyDown(
    index: number,
    e: React.KeyboardEvent<HTMLInputElement>
  ) {
    if (e.key === "Backspace") {
      if (digits[index]?.trim()) {
        const next = [...digits];
        next[index] = " ";
        applyDigits(next);
      } else if (index > 0) {
        focusIndex(index - 1);
        const next = [...digits];
        next[index - 1] = " ";
        applyDigits(next);
      }
      e.preventDefault();
    }
    if (e.key === "ArrowLeft" && index > 0) focusIndex(index - 1);
    if (e.key === "ArrowRight" && index < LENGTH - 1) focusIndex(index + 1);
  }

  function handlePaste(e: React.ClipboardEvent) {
    e.preventDefault();
    const pasted = e.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, LENGTH);
    if (!pasted) return;
    onChange(pasted);
    focusIndex(Math.min(pasted.length, LENGTH - 1));
  }

  return (
    <div className="flex justify-center gap-2" onPaste={handlePaste}>
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(el) => {
            inputsRef.current[index] = el;
          }}
          type="text"
          inputMode="numeric"
          autoComplete={index === 0 ? "one-time-code" : "off"}
          maxLength={1}
          disabled={disabled}
          value={digit.trim()}
          onChange={(e) => handleChange(index, e.target.value)}
          onKeyDown={(e) => handleKeyDown(index, e)}
          onFocus={(e) => e.target.select()}
          className={clsx(
            "h-12 w-10 rounded-xl border bg-black/30 text-center font-mono text-lg text-white outline-none transition sm:h-14 sm:w-12 sm:text-xl",
            error
              ? "border-red-500/50 focus:border-red-400"
              : "border-white/10 focus:border-sky-500/50"
          )}
          aria-label={`Digit ${index + 1}`}
        />
      ))}
    </div>
  );
}
