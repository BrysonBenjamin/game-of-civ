import type { VisibilityState } from "@/engine/types";

export function toFogFactor(vis: VisibilityState | undefined): number {
  if (!vis || vis === "visible") return 1.0;
  if (vis === "fog_of_war") return 0.5;
  return 0.0;
}
