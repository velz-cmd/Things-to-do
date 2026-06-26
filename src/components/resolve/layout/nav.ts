import { LayoutDashboard, Activity, CreditCard, User } from "lucide-react";

/** Workflow-first surfaces — not admin tabs */
export const PRODUCT_NAV = [
  { href: "/workspace", label: "Workspace", icon: LayoutDashboard, exact: false as const },
  { href: "/activity", label: "Activity", icon: Activity, exact: false as const },
  { href: "/payments", label: "Payments", icon: CreditCard, exact: false as const },
  { href: "/profile", label: "Profile", icon: User, exact: false as const },
] as const;

/** Legacy routes → product surfaces */
export const LEGACY_REDIRECTS: Record<string, string> = {
  "/radar": "/activity",
  "/weight": "/workspace",
  "/discover": "/workspace/fund",
  "/methodology": "/workspace",
  "/signals": "/workspace",
  "/settle": "/payments",
  "/claim": "/payments?tab=claim",
  "/blueprint": "/workspace",
  "/stack": "/workspace",
  "/protocol": "/workspace",
  "/missions": "/workspace",
  "/start": "/workspace",
  "/treasury": "/payments",
  "/distribute": "/payments",
  "/connectors": "/activity",
};
