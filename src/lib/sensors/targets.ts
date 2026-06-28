/** Sensor targets per community slug — scanned by GitHub / OpenAlex connectors. */

export type GitHubSensorTarget = { owner: string; repo: string };

export const COMMUNITY_GITHUB_TARGETS: Record<string, GitHubSensorTarget[]> = {
  react: [
    { owner: "facebook", repo: "react" },
    { owner: "vercel", repo: "next.js" },
    { owner: "remix-run", repo: "remix" },
  ],
  linux: [
    { owner: "torvalds", repo: "linux" },
    { owner: "gnome", repo: "gnome-shell" },
    { owner: "systemd", repo: "systemd" },
  ],
};

export const OPEN_RESEARCH_QUERIES = [
  "open science reproducibility",
  "machine learning benchmark dataset",
  "climate model open data",
];
