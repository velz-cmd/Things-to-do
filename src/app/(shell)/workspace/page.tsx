import { redirect } from "next/navigation";

/** Legacy /workspace → Mission Control */
export default function WorkspaceRedirect() {
  redirect("/control");
}
