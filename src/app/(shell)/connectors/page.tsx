import { redirect } from "next/navigation";

/** Connectors — admin surface lives under Settings */
export default function ConnectorsRedirect() {
  redirect("/settings");
}
