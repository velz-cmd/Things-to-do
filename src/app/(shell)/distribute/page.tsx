import { redirect } from "next/navigation";

export default function DistributeRedirect() {
  redirect("/missions?panel=distribute");
}
