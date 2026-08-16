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
    // Report the shape rather than rendering: a throw inside the component
    // happens after this function returns, so it cannot be caught here.
    const shape: Record<string, string> = {};
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      shape[key] = Array.isArray(value)
        ? `array(${value.length})`
        : value === null
          ? "null"
          : value === undefined
            ? "UNDEFINED"
            : typeof value === "object"
              ? `object{${Object.keys(value as object).slice(0, 12).join(",")}}`
              : `${typeof value}:${String(value).slice(0, 40)}`;
    }
    return (
      <pre style={{ padding: 16, color: "#0f0", whiteSpace: "pre-wrap", fontSize: 12 }}>
        {JSON.stringify(shape, null, 1)}
      </pre>
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
