import type { Metadata } from "next";
import { NetworkSurface } from "@/components/resolve/network/network-surface";

export const metadata: Metadata = {
  title: "Verify — RESOLVE",
  description: "What changed? Live value timeline across open ecosystems.",
};

export default function NetworkPage() {
  return <NetworkSurface />;
}
