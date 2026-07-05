import { RFB_PROGRAMS } from "@/lib/capital/ecosystem-program";

export type RfbBadge = {
  trackLabel: string;
  templateId: string;
};

/** User-facing program rail badge — track label only, no internal RFB numbers in UI. */
export function rfbBadgeForTemplate(templateId?: string | null): RfbBadge | null {
  if (!templateId) return null;
  const row = RFB_PROGRAMS.find((p) => p.id === templateId);
  if (!row) return null;
  return { trackLabel: row.trackLabel, templateId: row.id };
}
