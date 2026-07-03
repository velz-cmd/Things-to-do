# First Product Slice

This slice follows `docs/RESOLVE_PRODUCT_DOCTRINE.md`.

## Scope

Stabilize the existing production spine before adding new product surfaces:

- health and configuration routes
- Supabase auth and session capability checks
- settlement and Arc/Circle readiness
- environment diagnostics
- production URL and deploy verification
- proof-backed actions that move Discover opportunities toward Communities,
  Capital, Profile, or settlement

## Guardrails

- Do not rewrite existing APIs from scratch.
- Do not add fake demo data without explicit approval.
- Preserve existing route paths and response shapes unless a bug requires a narrow change.
- Prefer small compatibility fixes over product redesign.
- Run `npm ci`, `npm run build`, and `npm run lint` before opening a PR.

## Out Of Scope For This Slice

- new dashboards or primary navigation changes
- new connector business logic
- mock financial flows
- replacing the mission/value graph architecture
