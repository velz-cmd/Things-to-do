"use client";

import { User } from "lucide-react";
import { ProductPage } from "@/components/resolve/layout/product-page";

export function ProfileShell({ children }: { children: React.ReactNode }) {
  return (
    <ProductPage
      icon={User}
      title="Identity & connections"
      description="Connect once — GitHub, music, video, and wallet sync across Discover, Communities, and Capital."
      width="narrow"
      accent="blue"
    >
      <div className="space-y-8">{children}</div>
    </ProductPage>
  );
}
