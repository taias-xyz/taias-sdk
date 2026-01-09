import type { AffordanceRegistry, HandleRegistration } from "./types";
import { makeBindingKey } from "./types";

export type RegistryIndex = {
  byBindingKey: Map<string, HandleRegistration>;
};

export function buildRegistryIndex(registry?: AffordanceRegistry): RegistryIndex {
  const byBindingKey = new Map<string, HandleRegistration>();

  if (!registry) return { byBindingKey };

  for (const h of registry.handles) {
    byBindingKey.set(makeBindingKey(h.slot, h.bindsTo), h);
  }

  return { byBindingKey };
}
