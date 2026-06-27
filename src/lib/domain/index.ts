/**
 * Layer 1 — Core Domain (The Brain)
 *
 * RESOLVE knows entities, relationships, and observations.
 * Everything else is a projection or a window.
 *
 * @see docs/ARCHITECTURE.md
 */

export * from "@/lib/domain/entities";
export * from "@/lib/domain/relationships";
export * from "@/lib/domain/observation";
export * from "@/lib/domain/capabilities";
export * from "@/lib/domain/layers";
export * from "@/lib/domain/adapters";
