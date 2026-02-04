import type { Decision } from "../types";
import type { DefaultSlots, SlotMatch, UiSelections } from "./types";
import type { RegistryIndex } from "./indexing";
import { makeBindingKey } from "./types";

/**
 * Default slot-to-field mappings for the canonical slots.
 * Custom slots default to "nextTool" if not specified in slotMatch.
 */
const DEFAULT_SLOT_MATCH: Record<DefaultSlots, string> = {
  primaryCta: "nextTool",
  secondaryCta: "nextTool",
  widgetVariant: "nextTool",
};

export type SelectOptions<S extends string = DefaultSlots> = {
  slotMatch?: SlotMatch<S>;
  devMode?: boolean;
  onWarn?: (msg: string) => void;
};

/**
 * Select UI affordances based on flow decision.
 * Iterates over registered slots (from index) rather than hardcoded list.
 */
export function selectUiAffordances<S extends string = DefaultSlots>(
  decision: Decision,
  index: RegistryIndex<S>,
  opts: SelectOptions<S> = {}
): UiSelections<S> {
  const slotMatch = opts.slotMatch as Record<string, string> | undefined;
  const devMode = !!opts.devMode;
  const warn = opts.onWarn ?? (() => {});

  const selections: UiSelections<S> = {};

  // Iterate over registered slots, not hardcoded list
  for (const slot of index.slots) {
    // Use custom slotMatch, then DEFAULT_SLOT_MATCH for canonical slots, then "nextTool"
    const field =
      slotMatch?.[slot] ??
      DEFAULT_SLOT_MATCH[slot as DefaultSlots] ??
      "nextTool";
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
