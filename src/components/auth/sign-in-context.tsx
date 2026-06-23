"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

type SignInContextValue = {
  open: boolean;
  openSignIn: () => void;
  closeSignIn: () => void;
};

const SignInContext = createContext<SignInContextValue | null>(null);

export function SignInProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  const openSignIn = useCallback(() => setOpen(true), []);
  const closeSignIn = useCallback(() => setOpen(false), []);

  const value = useMemo(
    () => ({ open, openSignIn, closeSignIn }),
    [open, openSignIn, closeSignIn]
  );

  return (
    <SignInContext.Provider value={value}>{children}</SignInContext.Provider>
  );
}

export function useSignInModal() {
  const ctx = useContext(SignInContext);
  if (!ctx) {
    throw new Error("useSignInModal must be used within SignInProvider");
  }
  return ctx;
}
