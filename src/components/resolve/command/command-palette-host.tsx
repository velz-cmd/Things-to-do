"use client";

import { useState, useCallback, useEffect } from "react";
import { GlobalCommandPalette, useCommandPaletteShortcut } from "@/components/resolve/command/global-command-palette";

export function CommandPaletteHost() {
  const [open, setOpen] = useState(false);
  const openPalette = useCallback(() => setOpen(true), []);

  useCommandPaletteShortcut(openPalette);

  useEffect(() => {
    function onOpen() {
      setOpen(true);
    }
    window.addEventListener("resolve:open-command-palette", onOpen);
    return () => window.removeEventListener("resolve:open-command-palette", onOpen);
  }, []);

  return <GlobalCommandPalette open={open} onOpenChange={setOpen} />;
}
