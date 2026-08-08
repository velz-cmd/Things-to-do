import type { ResolveActionId } from "@/lib/actions/types";
import type {
  DiscoverAction,
  DiscoverWorkbenchTarget,
} from "@/lib/discover/marketplace/contracts";

type ActionCopy = {
  id: ResolveActionId;
  label: string;
  href: string;
  description?: string;
  enabled?: boolean;
  disabledReason?: string;
};

export function workbenchAction(
  action: ActionCopy,
  target: DiscoverWorkbenchTarget,
  options?: { requiresConfirmation?: boolean },
): DiscoverAction {
  return {
    ...action,
    enabled: action.enabled ?? true,
    requiresConfirmation: options?.requiresConfirmation,
    presentation: { kind: "workbench", target },
  };
}

export function discoverNavigationAction(
  action: ActionCopy,
  options: {
    target?: "discover" | "external" | "workspace";
    secondary?: boolean;
  } = {},
): DiscoverAction {
  return {
    ...action,
    enabled: action.enabled ?? true,
    presentation: {
      kind: "navigation",
      target: options.target ?? (action.href.startsWith("http") ? "external" : "discover"),
      secondary: options.secondary ?? false,
    },
  };
}
