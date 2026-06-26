import type { Metadata } from "next";
import { ActivitySurface } from "@/components/resolve/activity/activity-surface";

export const metadata: Metadata = {
  title: "Activity — RESOLVE",
  description: "Live value flow, authorizations, and connector activity across open ecosystems.",
};

export default function ActivityPage() {
  return <ActivitySurface />;
}
