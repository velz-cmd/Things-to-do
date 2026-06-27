import { redirect } from "next/navigation";

/** Verify / network feed — lives in Mission right panel, not a tab */
export default function NetworkRedirect() {
  redirect("/control");
}
