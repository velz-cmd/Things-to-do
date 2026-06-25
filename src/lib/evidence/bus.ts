import { createHash } from "crypto";
import type { WorkerEvidence } from "@/lib/evidence/types";

/**
 * Evidence Bus — workers publish here; only the Reasoning Engine reads the full bus.
 * Workers never call each other (Cursor-style orchestration).
 */
export class EvidenceBus {
  private readonly items: WorkerEvidence[] = [];

  publish(evidence: WorkerEvidence): void {
    this.items.push({ ...evidence, facts: [...evidence.facts] });
  }

  publishMany(batch: WorkerEvidence[]): void {
    for (const e of batch) this.publish(e);
  }

  byKind(kind: WorkerEvidence["kind"]): WorkerEvidence[] {
    return this.items.filter((e) => e.kind === kind);
  }

  bySubject(subjectId: string): WorkerEvidence[] {
    return this.items.filter((e) => e.subjectId === subjectId);
  }

  all(): WorkerEvidence[] {
    return [...this.items];
  }

  hash(): string {
    return createHash("sha256")
      .update(JSON.stringify(this.items.map((e) => ({ id: e.id, worker: e.worker, kind: e.kind }))))
      .digest("hex");
  }
}

export function evidenceId(worker: string, subjectId: string, suffix?: string): string {
  return createHash("sha256")
    .update(`${worker}:${subjectId}:${suffix ?? ""}`)
    .digest("hex")
    .slice(0, 16);
}
