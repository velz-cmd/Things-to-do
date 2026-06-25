/** Autonomous discovery agent — indexes unpaid value across open graphs. */

export type AgentLogLevel = "SCAN" | "FLAG" | "OK" | "ERR";

export type AgentLogEntry = {
  ts: string;
  level: AgentLogLevel;
  domain: string;
  message: string;
  detail?: string;
};

const SCAN_TEMPLATES: Omit<AgentLogEntry, "ts">[] = [
  { level: "SCAN", domain: "github", message: "GraphQL ingest · merged PRs + review threads" },
  { level: "FLAG", domain: "github", message: "repo health · 12k★ · 1 maintainer · critical funding gap" },
  { level: "SCAN", domain: "github", message: "Sybil Shield · trust score 12 · account created yesterday" },
  { level: "FLAG", domain: "github", message: "high-impact PR · latency -37% · included in v2.0 release" },
  { level: "SCAN", domain: "github", message: "Weight Council · code 92 · project 87 · economic 78" },
  { level: "FLAG", domain: "github", message: "founder intent · infrastructure 50% · docs 20% · applied" },
  { level: "SCAN", domain: "github", message: "dependency proxy · package used by 500 downstream repos" },
  { level: "OK", domain: "agent", message: "heartbeat · GitHub Phase 1 radar active" },
  { level: "ERR", domain: "sybil", message: "trust below threshold · PR rejected from allocation" },
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
