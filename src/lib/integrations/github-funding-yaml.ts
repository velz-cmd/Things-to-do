import { githubFetch } from "@/lib/github/client";

/**
 * Real GitHub FUNDING.yml ingestion (Phase 2 item 1).
 *
 * This proves ONE thing: the repository publishes an external funding
 * channel. It does NOT prove RESOLVE has a funding mechanism for it, that
 * money was received, or that any obligation is covered - callers must
 * only ever surface this as context (Details), never as an economic-state
 * claim. See software-funding-context.ts for the durable normalized shape
 * and the explicit separation from RESOLVE's own funding/demand model.
 *
 * No YAML dependency: GitHub's supported FUNDING.yml schema is a small,
 * flat set of known top-level keys with scalar or list-of-scalar values
 * (https://docs.github.com/en/repository-settings/... funding file) - a
 * general-purpose YAML parser (anchors, nested maps, arbitrary types)
 * would accept far more than GitHub's own schema and than we can safely
 * turn into a URL. This parser only recognizes that exact shape and
 * ignores/rejects anything else rather than guessing.
 */
export type FundingChannel = {
  provider: string;
  account: string;
  url: string;
};

const KNOWN_PROVIDERS = new Set([
  "github",
  "patreon",
  "open_collective",
  "ko_fi",
  "tidelift",
  "liberapay",
  "issuehunt",
  "custom",
]);

function providerUrl(provider: string, account: string): string | null {
  switch (provider) {
    case "github":
      return `https://github.com/sponsors/${account}`;
    case "patreon":
      return `https://www.patreon.com/${account}`;
    case "open_collective":
      return `https://opencollective.com/${account}`;
    case "ko_fi":
      return `https://ko-fi.com/${account}`;
    case "tidelift":
      return `https://tidelift.com/funding/github/${account}`;
    case "liberapay":
      return `https://liberapay.com/${account}`;
    case "issuehunt":
      return `https://issuehunt.io/r/${account}`;
    case "custom":
      // custom is the one provider whose value IS already a full URL -
      // must be http(s), never any other scheme.
      try {
        const parsed = new URL(account);
        return parsed.protocol === "https:" || parsed.protocol === "http:"
          ? parsed.toString()
          : null;
      } catch {
        return null;
      }
    default:
      return null;
  }
}

/** A bare account handle - never a scheme, control character, or absolute path. */
function safeAccount(value: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9._/-]{0,120}$/.test(value) && !value.includes("..");
}

function parseValues(raw: string, lines: string[], startIndex: number): { values: string[]; nextIndex: number } {
  const trimmed = raw.trim();
  if (!trimmed) {
    // Block list: subsequent lines like "  - value"
    const values: string[] = [];
    let i = startIndex;
    while (i < lines.length) {
      const line = lines[i];
      const match = /^\s+-\s*(.+)$/.exec(line);
      if (!match) break;
      values.push(stripQuotes(match[1].trim()));
      i += 1;
    }
    return { values, nextIndex: i };
  }
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    const inner = trimmed.slice(1, -1);
    const values = inner
      .split(",")
      .map((v) => stripQuotes(v.trim()))
      .filter(Boolean);
    return { values, nextIndex: startIndex };
  }
  return { values: [stripQuotes(trimmed)], nextIndex: startIndex };
}

function stripQuotes(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

/** Parses raw FUNDING.yml text. Never throws - malformed content yields no channels. */
export function parseFundingYaml(content: string): FundingChannel[] {
  const channels: FundingChannel[] = [];
  const seen = new Set<string>();
  try {
    const lines = content.split(/\r?\n/).map((line) => line.replace(/#.*$/, ""));
    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      const keyMatch = /^([A-Za-z0-9_]+):\s*(.*)$/.exec(line);
      if (!keyMatch) {
        i += 1;
        continue;
      }
      const provider = keyMatch[1].toLowerCase();
      const { values, nextIndex } = parseValues(keyMatch[2], lines, i + 1);
      i = nextIndex > i ? nextIndex : i + 1;

      if (!KNOWN_PROVIDERS.has(provider)) continue;

      for (const account of values) {
        if (!account) continue;
        if (provider !== "custom" && !safeAccount(account)) continue;
        const url = providerUrl(provider, account);
        if (!url) continue;
        const dedupeKey = `${provider}:${url.toLowerCase()}`;
        if (seen.has(dedupeKey)) continue;
        seen.add(dedupeKey);
        channels.push({ provider, account, url });
      }
    }
  } catch {
    return [];
  }
  return channels;
}

/**
 * Fetches and parses `.github/FUNDING.yml` for a repository. Returns
 * undefined when the file does not exist or the request fails - never an
 * empty array standing in for "no funding channels exist" (an empty
 * array IS a valid observation once parsing actually ran against real
 * content; undefined means no content was observed at all).
 */
export async function fetchFundingChannels(
  owner: string,
  repo: string,
  branch = "HEAD",
): Promise<FundingChannel[] | undefined> {
  const content = await githubFetch<{ content?: string; encoding?: string }>(
    `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/.github/FUNDING.yml?ref=${encodeURIComponent(branch)}`,
    { revalidate: 86_400 },
  );
  if (!content?.content || content.encoding !== "base64") return undefined;

  let decoded: string;
  try {
    decoded = Buffer.from(content.content.replaceAll("\n", ""), "base64").toString("utf8");
  } catch {
    return undefined;
  }

  const channels = parseFundingYaml(decoded);
  return channels;
}
