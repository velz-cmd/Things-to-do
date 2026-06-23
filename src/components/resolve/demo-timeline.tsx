import { DEMO_TIMELINE } from "@/lib/resolve/progress";

export function DemoTimeline() {
  return (
    <section className="rounded-xl border border-dashed border-deputy-border bg-deputy-panel/50 p-5">
      <p className="text-xs uppercase tracking-wide text-deputy-muted">
        Example mission — see how RESOLVE works
      </p>
      <ul className="mt-4 space-y-2">
        {DEMO_TIMELINE.map((step) => (
          <li key={step.label} className="flex items-center gap-3 text-sm">
            <span className={step.done ? "text-deputy-accent" : "text-deputy-muted"}>
              {step.done ? "✓" : "○"}
            </span>
            <span
              className={
                step.highlight ? "font-semibold text-deputy-accent" : "text-deputy-muted"
              }
            >
              {step.label}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
