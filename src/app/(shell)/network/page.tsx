import type { Metadata } from "next";
import { NetworkSurface } from "@/components/resolve/network/network-surface";

export const metadata: Metadata = {
  title: "Network — RESOLVE",
  description: "What is happening globally?",
};

export default function NetworkPage() {
  return <NetworkSurface />;
}
