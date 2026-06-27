"use client";

import type { MissionReportSection } from "@/lib/mission/mission-report";

function Section({ section }: { section: MissionReportSection }) {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-resolve-muted-dim">
        {section.title}
      </p>
      <p className="mt-2 text-sm text-white/95">{section.content}</p>
      {section.items && section.items.length > 0 && (
        <ul className="mt-2 space-y-1">
          {section.items.map((item) => (
            <li key={item} className="text-xs text-resolve-muted before:mr-2 before:content-['•']">
              {item}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function MissionReportSections({
  understanding,
  capitalDesign,
  executionPlan,
  risks,
  recommendation,
}: {
  understanding?: MissionReportSection;
  capitalDesign?: MissionReportSection;
  executionPlan?: MissionReportSection;
  risks?: MissionReportSection;
  recommendation?: MissionReportSection;
}) {
  const sections = [understanding, capitalDesign, risks, recommendation, executionPlan].filter(
    Boolean,
  ) as MissionReportSection[];

  if (!sections.length) return null;

  return (
    <div className="space-y-3">
      {sections.map((s) => (
        <Section key={s.title} section={s} />
      ))}
    </div>
  );
}
