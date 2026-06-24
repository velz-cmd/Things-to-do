import { redirect } from "next/navigation";

export default function ContributorsRedirect() {
  redirect("/missions?panel=registry");
}
