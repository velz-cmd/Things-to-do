import type { Metadata } from "next";
import { MissionReportView } from "@/components/resolve/mission-control/mission-report-view";

export const metadata: Metadata = {
  title: "Mission receipt — RESOLVE",
  description: "Decision package — who gets paid, with proof.",
};

type PageProps = { params: Promise<{ id: string }> };

export default async function MissionReportPage({ params }: PageProps) {
  const { id } = await params;
  return <MissionReportView reportId={id} />;
}
