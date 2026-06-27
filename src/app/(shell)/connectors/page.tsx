import { redirect } from "next/navigation";

/** Connectors — identity & sensors live under Me */
export default function ConnectorsRedirect() {
  redirect("/profile");
}
