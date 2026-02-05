import type { Decision } from "../types";
import type { DefaultSlots, UiSelections } from "./types";
import type { RegistryIndex } from "./indexing";
import { makeBindingKey } from "./types";

export type SelectOptions = {
  devMode?: boolean;
  onWarn?: (msg: string) => void;
};

/**
 * Select UI affordances based on flow decision.
 * Uses the inferred decision field for each slot from the registry index.
 */
export function selectUiAffordances<S extends string = DefaultSlots>(
  decision: Decision,
  index: RegistryIndex<S>,
  opts: SelectOptions = {}
): UiSelections<S> {
  const devMode = !!opts.devMode;
  const warn = opts.onWarn ?? (() => {});

  const selections: UiSelections<S> = {};

  for (const slot of index.slots) {
    // Use inferred key from handle bindings
    const field = index.slotKeyMap.get(slot);
    if (!field) continue;

    const value = decision[field];
    if (!value) continue;

    const k = makeBindingKey(slot, { key: field, value });
    const handle = index.byBindingKey.get(k);

    if (!handle) {
      if (devMode) warn(`[Taias] No affordance for slot "${slot}" when ${field}="${value}"`);
      continue;
    }

    (selections as Record<string, unknown>)[slot] = {
      handleId: handle.handleId,
      bindsTo: handle.bindsTo,
    };
  }

  return selections;
}
