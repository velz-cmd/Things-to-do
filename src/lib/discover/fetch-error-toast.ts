import { toast } from "sonner";

/** Deduped discover surface error with inline retry — only when section has no cached data. */
export function discoverFetchErrorToast(
  toastId: string,
  message: string,
  retry: () => void,
  hasCachedData: boolean,
) {
  if (hasCachedData) return;
  toast.error(message, {
    id: toastId,
    action: {
      label: "Retry",
      onClick: () => void retry(),
    },
  });
}
