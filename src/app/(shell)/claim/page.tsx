import { redirect } from "next/navigation";

export default function ClaimPage() {
  redirect("/payments?tab=claim");
}
