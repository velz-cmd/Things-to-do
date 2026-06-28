import { redirect } from "next/navigation";

/** Network tab removed — global activity lives in Discover + community capital flow */
export default function NetworkPage() {
  redirect("/discover");
}
