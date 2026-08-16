import { DiscoverMarketplace } from "@/components/resolve/discover/marketplace/discover-marketplace";
import { parseOpportunityFilters } from "@/lib/discover/marketplace/filters";
import { loadDiscoverPageData } from "@/lib/discover/marketplace/query";

/**
 * TEMPORARY. Remove before finalising.
 *
 * The first authenticated request to any page returns 500 and then recovers,
 * but the same data load succeeds inside a route handler - so the failure is
 * in the page render, which a route handler cannot reproduce. This renders
 * the real page in stages and reports which stage throws.
 */
export const dynamic = "force-dynamic";

export default async function DiagPage() {
  const filters = parseOpportunityFilters({});

  let data;
  try {
    data = await loadDiscoverPageData(filters, "for_you");
  } catch (error) {
    return (
      <pre style={{ padding: 24, color: "#fff", whiteSpace: "pre-wrap" }}>
        {"STAGE=load\n" +
          (error instanceof Error
            ? `${error.name}: ${error.message}\n${(error.stack ?? "").split("\n").slice(1, 5).join("\n")}`
            : String(error))}
      </pre>
    );
  }

  try {
    return (
      <>
        <pre style={{ padding: 12, color: "#0f0" }}>
          {`STAGE=render pools=${data.pools.length} activity=${(data.activity ?? []).length}`}
        </pre>
        <DiscoverMarketplace data={data} filters={filters} />
      </>
    );
  } catch (error) {
    return (
      <pre style={{ padding: 24, color: "#fff", whiteSpace: "pre-wrap" }}>
        {"STAGE=render\n" +
          (error instanceof Error
            ? `${error.name}: ${error.message}\n${(error.stack ?? "").split("\n").slice(1, 5).join("\n")}`
            : String(error))}
      </pre>
    );
  }
}
