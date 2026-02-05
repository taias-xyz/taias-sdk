import type { AffordanceRegistry, DefaultSlots, HandleRegistration } from "./types";
import { makeBindingKey } from "./types";

/**
 * Index structure for efficient affordance lookup.
 * Generic over slot type S for custom slot support.
 */
export type RegistryIndex<S extends string = DefaultSlots> = {
  byBindingKey: Map<string, HandleRegistration<S>>;
  slots: Set<S>;
  /** Inferred decision field for each slot, derived from handle bindings. */
  slotKeyMap: Map<S, string>;
};

/**
 * Build an index from a registry for efficient lookup during selection.
 * Tracks which slots have registered handles and infers the decision field
 * for each slot from its handle bindings.
 *
 * @throws Error if handles for the same slot bind to different keys
 */
export function buildRegistryIndex<S extends string = DefaultSlots>(
  registry?: AffordanceRegistry<S>
): RegistryIndex<S> {
  const byBindingKey = new Map<string, HandleRegistration<S>>();
  const slots = new Set<S>();
  const slotKeyMap = new Map<S, string>();

  if (!registry) return { byBindingKey, slots, slotKeyMap };

  for (const h of registry.handles) {
    slots.add(h.slot);

    // Infer and validate slot key
    const existingKey = slotKeyMap.get(h.slot);
    if (existingKey && existingKey !== h.bindsTo.key) {
      throw new Error(
        `[Taias] Slot "${h.slot}" has handles bound to different keys: "${existingKey}" and "${h.bindsTo.key}". ` +
          `All handles for a slot must use the same decision field.`
      );
    }
    slotKeyMap.set(h.slot, h.bindsTo.key);

    byBindingKey.set(makeBindingKey(h.slot, h.bindsTo), h);
  }

  return { byBindingKey, slots, slotKeyMap };
}
