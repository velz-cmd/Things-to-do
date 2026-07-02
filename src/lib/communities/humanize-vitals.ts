import type { CommunityVitalsSummary } from "@/lib/communities/types";

/** Product language for community vitals — hide sensor/backend jargon in UI. */
export function humanizeSensorLabel(label: string): string {
  const lower = label.toLowerCase();
  if (lower.includes("awaiting github")) return "Connect GitHub in Profile";
  if (lower.includes("awaiting sync") || lower.includes("awaiting config")) {
    return "Needs connection";
  }
  if (lower.includes("sensor live") || lower === "sensor live") return "Proof active";
  if (lower.includes("observing")) return "Connected";
  if (lower.includes("needs signal")) return "Needs activity";
  return label.replace(/\bsensor\b/gi, "Proof").replace(/\bobserve\b/gi, "sync");
}

export function humanizeHealthLabel(label: string): string {
  const lower = label.toLowerCase();
  if (lower.includes("observing")) return "Syncing activity";
  if (lower.includes("warming")) return "Warming up";
  if (lower.includes("healthy")) return "Healthy";
  if (lower.includes("awaiting")) return "Needs connection";
  return label;
}

export function displayVitals(vitals: CommunityVitalsSummary): CommunityVitalsSummary {
  return {
    ...vitals,
    healthLabel: humanizeHealthLabel(vitals.healthLabel),
    sensor: {
      ...vitals.sensor,
      label: humanizeSensorLabel(vitals.sensor.label),
    },
    observeNarrative: "",
  };
}
