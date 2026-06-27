import { redirect } from "next/navigation";

/** Connectors are infrastructure — managed from Discover */
export default function ConnectorsRedirect() {
  redirect("/discover");
}
