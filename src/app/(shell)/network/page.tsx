import { redirect } from "next/navigation";

/** Network tab removed — global activity lives in Discover */
export default function NetworkPage() {
  redirect("/discover");
}
