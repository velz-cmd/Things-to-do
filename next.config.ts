import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // TypeScript is validated before release by the required GitHub Actions job.
  // Running the same whole-project check in the 8 GB Vercel build exhausted
  // the build worker after compilation and prevented otherwise valid commits
  // from reaching the Git-integration deployment.
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG ?? "resolve-n2",
  project: process.env.SENTRY_PROJECT ?? "javascript-nextjs",
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  widenClientFileUpload: true,
  disableLogger: true,
  automaticVercelMonitors: true,
  sourcemaps: {
    disable: !process.env.SENTRY_AUTH_TOKEN,
  },
});
