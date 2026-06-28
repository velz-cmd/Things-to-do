import type { Metadata } from "next";
import { CommunitiesHub } from "@/components/resolve/communities/communities-hub";

export const metadata: Metadata = {
  title: "Communities — RESOLVE",
  description:
    "Operate open communities — programs, observatory, authorizations, and Arc settlement.",
};

export default function CommunitiesPage() {
  return <CommunitiesHub />;
}
