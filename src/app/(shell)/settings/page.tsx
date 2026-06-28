import type { Metadata } from "next";
import { SettingsSurface } from "@/components/resolve/settings/settings-surface";

export const metadata: Metadata = {
  title: "Settings — RESOLVE",
  description: "Connectors, operator keys, and integration health.",
};

export default function SettingsPage() {
  return <SettingsSurface />;
}
