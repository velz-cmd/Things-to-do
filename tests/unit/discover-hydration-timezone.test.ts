import { describe, expect, it } from "vitest";
import { dateLabel } from "@/components/resolve/discover/marketplace/discover-marketplace";

/**
 * Regression test for the root cause of React error #418 (authenticated
 * Discover hydration mismatch), found via a deterministic SSR/client digest
 * comparison on a live deployment: dateLabel() formatted the same timestamp
 * differently depending on the runtime's local timezone (Vercel's server
 * always runs in UTC; a viewer's browser does not), so a timestamp shortly
 * after UTC midnight rendered as a different calendar day on the client
 * than on the server - a genuine text-node mismatch, not a false positive.
 *
 * This test locks dateLabel() to always resolve via UTC regardless of the
 * process's own local timezone, by exercising a timestamp that is known to
 * cross a calendar-day boundary in at least one common non-UTC zone.
 */
describe("dateLabel", () => {
  it("formats a fixed UTC calendar day, independent of the process's local timezone", () => {
    // 2026-08-18T02:00:00Z is Aug 18 in UTC but Aug 17 in US Pacific -
    // exactly the kind of timestamp that exposed the bug live.
    expect(dateLabel("2026-08-18T02:00:00.000Z")).toBe("Aug 18, 2026");
  });

  it("does not silently drift to the previous UTC day near midnight", () => {
    expect(dateLabel("2026-01-01T00:30:00.000Z")).toBe("Jan 1, 2026");
  });
});
