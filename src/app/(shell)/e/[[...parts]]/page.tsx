import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EntityPage } from "@/components/resolve/entity/entity-page";
import { entityPathToId } from "@/lib/entity/paths";
import { buildEntitySurface } from "@/lib/entity/surface";

type Props = { params: Promise<{ parts?: string[] }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { parts } = await params;
  const entityId = entityPathToId(parts ?? []);
  if (!entityId) return { title: "Entity — RESOLVE" };

  const surface = await buildEntitySurface(entityId);
  if (!surface) return { title: "Entity — RESOLVE" };

  return {
    title: `${surface.label} — RESOLVE`,
    description: surface.subtitle,
  };
}

export default async function EntityRoutePage({ params }: Props) {
  const { parts } = await params;
  const entityId = entityPathToId(parts ?? []);
  if (!entityId) notFound();

  const surface = await buildEntitySurface(entityId);
  if (!surface) notFound();

  return <EntityPage initial={surface} />;
}
