import { NextRequest, NextResponse } from "next/server";
import {
  parseDiscoverView,
  parseOpportunityFilters,
} from "@/lib/discover/marketplace/filters";
import { listMarketplaceOpportunities } from "@/lib/discover/marketplace/query";
import { API_CACHE } from "@/lib/api/cache-headers";

export async function GET(request: NextRequest) {
  const params = Object.fromEntries(request.nextUrl.searchParams.entries());
  const result = await listMarketplaceOpportunities(
    parseOpportunityFilters(params),
    undefined,
    parseDiscoverView(params.view),
  );
  const status = result.items.length === 0 && result.failures.length >= 3 ? 503 : 200;
  const response = NextResponse.json(result, { status });
  response.headers.set(
    "Cache-Control",
    result.failures.length > 0 ? API_CACHE.noStore : API_CACHE.publicShort,
  );
  response.headers.set("Vary", "Accept-Encoding");
  return response;
}
