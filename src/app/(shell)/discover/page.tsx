import { redirect } from "next/navigation";

/** Observe / discover — lives inside Mission chat, not a tab */
export default function DiscoverRedirect() {
  redirect("/control");
}
