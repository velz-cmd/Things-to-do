import { describe, expect, it } from "vitest";
import { tailorDiscoverActionsForUser } from "@/lib/discover/tailor-actions-for-user";
import type { UserConnectionState } from "@/lib/profile/connection-state-types";

const connectedState: UserConnectionState = {
  signedIn: true,
  userId: "u1",
  updatedAt: new Date().toISOString(),
  lastSyncedAt: new Date().toISOString(),
  platforms: [],
  installedCommunitySlugs: ["react"],
  hasAnyConnector: true,
  githubUsername: "octocat",
};

describe("tailorDiscoverActionsForUser", () => {
  it("rewrites install to console when community already installed", () => {
    const [action] = tailorDiscoverActionsForUser(
      [
        {
          id: "install",
          label: "Install community",
          kind: "install",
          communitySlug: "react",
        },
      ],
      connectedState,
    );
    expect(action?.kind).toBe("console");
    expect(action?.label).toContain("React");
    expect(action?.href).toBeUndefined();
    expect(action?.communitySlug).toBe("react");
  });

  it("leaves fund actions unchanged", () => {
    const [action] = tailorDiscoverActionsForUser(
      [
        {
          id: "fund",
          label: "Fund",
          kind: "fund",
          programId: "p1",
          communitySlug: "react",
        },
      ],
      connectedState,
    );
    expect(action?.kind).toBe("fund");
  });
});
