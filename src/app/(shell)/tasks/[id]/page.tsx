import { redirect } from "next/navigation";

export default async function LegacyTaskRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/missions/${id}`);
}
