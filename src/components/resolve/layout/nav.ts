import { LayoutDashboard, CreditCard, Plug, User } from "lucide-react";

/** Four product workflows — not backend systems */
export const PRODUCT_NAV = [
  { href: "/workspace", label: "Workspace", icon: LayoutDashboard, exact: false as const },
  { href: "/payments", label: "Payments", icon: CreditCard, exact: false as const },
  { href: "/connectors", label: "Connectors", icon: Plug, exact: false as const },
  { href: "/profile", label: "Profile", icon: User, exact: false as const },
] as const;

/** Legacy routes → new product surfaces */
export const LEGACY_REDIRECTS: Record<string, string> = {
  "/radar": "/workspace",
  "/weight": "/workspace",
  "/discover": "/workspace",
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
  "/connectors": "/connectors",
};
