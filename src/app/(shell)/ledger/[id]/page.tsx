import { redirect } from "next/navigation";

type Props = { params: Promise<{ id: string }> };

/** Legacy URL — forwards to user-friendly /receipt/[id]. */
export default async function LedgerRedirectPage({ params }: Props) {
  const { id } = await params;
  redirect(`/receipt/${id}`);
}
