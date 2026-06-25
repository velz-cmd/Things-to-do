/** Autonomous discovery agent — scans for unpaid value (Rug Jeez-style agent log). */

export type AgentLogLevel = "SCAN" | "FLAG" | "OK" | "ERR";

export type AgentLogEntry = {
  ts: string;
  level: AgentLogLevel;
  domain: string;
  message: string;
  detail?: string;
};

const SCAN_TEMPLATES: Omit<AgentLogEntry, "ts">[] = [
  { level: "SCAN", domain: "github", message: "live API · navidrome/navidrome contributors · ranking unpaid value" },
  { level: "FLAG", domain: "github", message: "live builder · high commits · $0 on-chain payouts detected" },
  { level: "SCAN", domain: "navidrome", message: "scrobble aggregate · artist mbid-night-signals · 14.2k plays/30d" },
  { level: "FLAG", domain: "navidrome", message: "top artist · no payee registry · ~$890 unpaid est." },
  { level: "SCAN", domain: "mastodon", message: "engagement share · @writer@fosstodon.org · 40% of instance" },
  { level: "FLAG", domain: "mastodon", message: "creator drives growth · zero campaign payouts" },
  { level: "SCAN", domain: "immich", message: "EXIF attribution · Marcus Lee · 218 shared assets" },
  { level: "SCAN", domain: "github", message: "PR depth · designer-alex · 94% acceptance · 0 bounties paid" },
  { level: "OK", domain: "agent", message: "heartbeat · scanning 5 community sources" },
  { level: "ERR", domain: "registry", message: "payee lookup · mbid-indie-wave · not registered" },
];

let logBuffer: AgentLogEntry[] = [];
let lastTick = 0;

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function formatTs(d: Date) {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function pushEntry(entry: Omit<AgentLogEntry, "ts">) {
  const row: AgentLogEntry = { ...entry, ts: formatTs(new Date()) };
  logBuffer = [row, ...logBuffer].slice(0, 80);
  return row;
}

/** Called per request — appends synthetic scan events so the log feels alive. */
export function tickDiscoveryAgent(): AgentLogEntry[] {
  const now = Date.now();
  if (now - lastTick > 8000 || logBuffer.length < 12) {
    lastTick = now;
    const template = SCAN_TEMPLATES[Math.floor(Math.random() * SCAN_TEMPLATES.length)];
    pushEntry(template);
  }
  return logBuffer;
}

export function getAgentLog(limit = 40): AgentLogEntry[] {
  tickDiscoveryAgent();
  return logBuffer.slice(0, limit);
}

export function seedAgentLog() {
  if (logBuffer.length > 0) return;
  const base = new Date();
  SCAN_TEMPLATES.slice(0, 8).forEach((t, i) => {
    const d = new Date(base.getTime() - i * 12000);
    logBuffer.push({ ...t, ts: formatTs(d) });
  });
}

seedAgentLog();

export const AGENT_STATUS = {
  id: "resolve-discovery@arc-testnet",
  uptimeHours: 168,
  sourcesMonitored: 5,
  buildersFlagged: 5,
  lastScanMs: 8000,
};
