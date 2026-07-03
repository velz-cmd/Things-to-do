# RESOLVE UI and Performance Notes

## Design Direction

Discover should feel like a command-first operating surface:

- Command/search first.
- Job launcher second.
- Opportunity rows before visualization.
- Primary CTAs must create value.
- Secondary actions should support proof, analysis, funding, or community operation.
- Loading states should look like the final content, not a waiting room.

## Current Safe Wins

- Keep the current Vercel deployment and measure with Vercel Speed Insights before changing hosts.
- Use content-shaped skeletons and streaming boundaries for slow live data.
- Cache stable public radar/search inputs before adding more client polling.
- Prefer optimistic action states for create/fund/connect actions after the API call starts.

## Provider Options To Evaluate

- Vercel: best first stop because production is already there. Use Speed Insights and native caching before adding more vendors.
- Next.js caching: use cacheable server work for stable public data and Suspense fallbacks for fresh personalized data.
- Upstash Redis: already in dependencies; good for API response caching, rate limits, and lightweight queues.
- Cloudflare Cache/CDN: useful in front of public assets and public GET endpoints if Vercel-native caching is not enough.

## Do Not Do

- Do not add fake demo data to make the UI feel alive.
- Do not add a second identity/connector flow outside Profile.
- Do not make Discover an analytics dashboard.
- Do not add a new provider until a measured bottleneck justifies it.
