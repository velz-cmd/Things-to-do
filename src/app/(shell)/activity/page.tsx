import { redirect } from "next/navigation";

/** Legacy /activity → Verify / Network */
export default function ActivityRedirect() {
  redirect("/network");
}
