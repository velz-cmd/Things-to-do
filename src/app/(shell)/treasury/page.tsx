import { redirect } from "next/navigation";

export default function TreasuryRedirect() {
  redirect("/missions?panel=treasury");
}
