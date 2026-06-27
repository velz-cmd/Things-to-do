import { redirect } from "next/navigation";

/** Activity — merged into Mission live feed */
export default function ActivityRedirect() {
  redirect("/control");
}
