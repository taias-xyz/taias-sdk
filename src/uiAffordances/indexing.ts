import type { AffordanceRegistry, DefaultSlots, HandleRegistration } from "./types";
import { makeBindingKey } from "./types";

/**
 * Index structure for efficient affordance lookup.
 * Generic over slot type S for custom slot support.
 */
export type RegistryIndex<S extends string = DefaultSlots> = {
  byBindingKey: Map<string, HandleRegistration<S>>;
  slots: Set<S>;
};

/**
 * Build an index from a registry for efficient lookup during selection.
 * Tracks which slots have registered handles.
 */
export function buildRegistryIndex<S extends string = DefaultSlots>(
  registry?: AffordanceRegistry<S>
): RegistryIndex<S> {
  const byBindingKey = new Map<string, HandleRegistration<S>>();
  const slots = new Set<S>();

  if (!registry) return { byBindingKey, slots };

  for (const h of registry.handles) {
    slots.add(h.slot);
    byBindingKey.set(makeBindingKey(h.slot, h.bindsTo), h);
  }

  return { byBindingKey, slots };
}
