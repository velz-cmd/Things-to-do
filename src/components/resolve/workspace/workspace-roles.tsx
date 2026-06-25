import Link from "next/link";
import { Panel } from "@/components/resolve/ui/panel";
import { Banknote, LayoutDashboard } from "lucide-react";

/** Clear roles — founders vs contributors, one product, two paths. */
export function WorkspaceRoles() {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <Panel className="flex items-start gap-3 p-4">
        <LayoutDashboard className="mt-0.5 h-4 w-4 shrink-0 text-resolve-accent" />
        <div>
          <p className="text-sm font-medium text-white">Founders</p>
          <p className="mt-0.5 text-xs text-resolve-muted">
            Paste a repository, review evidence, approve funding — all on this page.
          </p>
        </div>
      </Panel>
      <Panel className="flex items-start gap-3 p-4">
        <Banknote className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
        <div>
          <p className="text-sm font-medium text-white">Contributors</p>
          <p className="mt-0.5 text-xs text-resolve-muted">
            Claim rewards on{" "}
            <Link href="/payments?tab=claim" className="text-resolve-accent hover:underline">
              Payments
            </Link>
            {" "}— sign in with GitHub, connect wallet, claim.
          </p>
        </div>
      </Panel>
    </div>
  );
}
