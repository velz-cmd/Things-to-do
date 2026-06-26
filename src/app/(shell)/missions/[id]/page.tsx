import { redirect } from "next/navigation";

export default async function MissionIdRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/workspace?mission=${id}`);
}
