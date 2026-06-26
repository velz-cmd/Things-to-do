import { redirect } from "next/navigation";

/** Connectors are infrastructure — managed from Activity */
export default function ConnectorsRedirect() {
  redirect("/activity");
}
