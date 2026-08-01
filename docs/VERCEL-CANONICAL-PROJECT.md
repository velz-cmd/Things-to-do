# Canonical Vercel production project

RESOLVE production is owned by the following Vercel project:

- Team: `resolve-os-new`
- Team ID: `team_JE6WKRJNgG5DlDCnTMQA23pB`
- Project: `resolve`
- Project ID: `prj_0xIUtSzxZ2Cqeie8eHYB6iPAKIN0`
- Production domain: `https://resolve-self.vercel.app`
- Deployment source: Git Integration from `main`

Do not disconnect or modify this Git Integration. Do not create a second
production deployment with the CLI or a deploy hook when the Git Integration
has already started a build.

## External cleanup item

`ibrahim26/things-to-do` is an obsolete project owned by another Vercel
account. Its Git connection can be removed later by that account owner. This
account-level cleanup does not block the canonical RESOLVE project.

The repository keeps a project-ID guard in `scripts/vercel-should-build.sh`.
Any Vercel project other than the canonical project ID exits through the
ignored-build path. The obsolete project may therefore publish a canceled or
skipped GitHub status, but it must not build, reach READY, or receive production
traffic for a RESOLVE commit.
