import type { CanonicalSlot, Decision, SlotMatch, UiSelections } from "./types";
import type { RegistryIndex } from "./indexing";
import { makeBindingKey } from "./types";

const DEFAULT_SLOT_MATCH: Required<Record<CanonicalSlot, string>> = {
  primaryCta: "nextTool",
  secondaryCta: "nextTool",
  widgetVariant: "nextTool",
};

export type SelectOptions = {
  slotMatch?: SlotMatch;
  devMode?: boolean;
  onWarn?: (msg: string) => void;
};

export function selectUiAffordances(
  decision: Decision,
  index: RegistryIndex,
  opts: SelectOptions = {}
): UiSelections {
  const slotMatch = { ...DEFAULT_SLOT_MATCH, ...(opts.slotMatch ?? {}) };
  const devMode = !!opts.devMode;
  const warn = opts.onWarn ?? (() => {});

  const selections: UiSelections = {};
  const slots = Object.keys(DEFAULT_SLOT_MATCH) as CanonicalSlot[];

  for (const slot of slots) {
    const field = slotMatch[slot];
    const value = decision[field];
    if (!value) continue;

    const k = makeBindingKey(slot, { key: field, value });
    const handle = index.byBindingKey.get(k);

    if (!handle) {
      if (devMode) warn(`[Taias] No affordance for slot "${slot}" when ${field}="${value}"`);
      continue;
    }

    selections[slot] = { handleId: handle.handleId, bindsTo: handle.bindsTo };
  }

  return selections;
}
