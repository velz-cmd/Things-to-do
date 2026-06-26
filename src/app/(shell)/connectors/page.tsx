import { redirect } from "next/navigation";

/** Connectors are infrastructure — surfaced inside Workspace only */
export default function ConnectorsRedirect() {
  redirect("/workspace");
}
