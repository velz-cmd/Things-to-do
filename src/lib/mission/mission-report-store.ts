import type { MissionBlueprintPackage, MissionBlueprintStatus } from "@/lib/mission/mission-blueprint-package";
import { simulateBlueprintPackage } from "@/lib/mission/mission-blueprint-package";

export type MissionReportRecord = MissionBlueprintPackage & {
  status: MissionBlueprintStatus;
  createdAt: string;
  simulatedAt?: string;
  authorizedAt?: string;
  simulation?: ReturnType<typeof simulateBlueprintPackage>;
  fundTxLabel?: string;
};

const STORAGE_KEY = "resolve-mission-reports";
const MAX_REPORTS = 40;

function readAll(): MissionReportRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as MissionReportRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(reports: MissionReportRecord[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(reports.slice(0, MAX_REPORTS)));
}

export function saveMissionReport(record: MissionReportRecord): void {
  const all = readAll().filter((r) => r.id !== record.id);
  writeAll([record, ...all]);
}

export function loadMissionReport(id: string): MissionReportRecord | null {
  return readAll().find((r) => r.id === id) ?? null;
}

export function listMissionReports(): MissionReportRecord[] {
  return readAll();
}

export function createReportFromPackage(
  pkg: MissionBlueprintPackage,
  status: MissionBlueprintStatus,
  extras?: Partial<MissionReportRecord>,
): MissionReportRecord {
  const now = new Date().toISOString();
  return {
    ...pkg,
    status,
    createdAt: now,
    simulatedAt: status === "simulated" || status === "authorized" ? now : undefined,
    authorizedAt: status === "authorized" ? now : undefined,
    simulation:
      status !== "draft" ? simulateBlueprintPackage(pkg) : undefined,
    ...extras,
  };
}
