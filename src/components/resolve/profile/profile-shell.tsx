"use client";

import { User } from "lucide-react";
import { ProductPage } from "@/components/resolve/layout/product-page";

export function ProfileShell({ children }: { children: React.ReactNode }) {
  return (
    <ProductPage
      icon={User}
      title="Who am I in this ecosystem?"
      description="RESOLVE attaches to communities you already use — GitHub, Jellyfin, music servers, and more. Connect once per community so we can credit you when work happens upstream. Your audience doesn't need RESOLVE."
      workflows={[
        { label: "Open source" },
        { label: "Music" },
        { label: "Video" },
        { label: "Get paid" },
      ]}
      width="narrow"
      accent="blue"
    >
      <p className="mb-6 text-right">
        <a href="/settings" className="text-xs text-resolve-accent hover:underline">
          Settings — connectors & keys →
        </a>
      </p>
      <div className="space-y-10">{children}</div>
    </ProductPage>
  );
}
