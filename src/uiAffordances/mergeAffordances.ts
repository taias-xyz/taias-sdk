import type { AffordanceRegistry } from "./types";
import { makeBindingKey } from "./types";

export type MergeAffordancesOptions = {
  devMode?: boolean;
  onWarn?: (msg: string) => void;
};

export function mergeAffordances(
  registries: AffordanceRegistry[],
  opts: MergeAffordancesOptions = {}
): AffordanceRegistry {
  const devMode = !!opts.devMode;
  const warn = opts.onWarn ?? (() => {});

  const merged: AffordanceRegistry = { handles: registries.flatMap((r) => r.handles) };

  if (!devMode) return merged;

  // Check for duplicate handleIds
  const seenHandleIds = new Set<string>();
  for (const h of merged.handles) {
    if (seenHandleIds.has(h.handleId)) {
      throw new Error(`[Taias] Duplicate handleId "${h.handleId}"`);
    }
    seenHandleIds.add(h.handleId);
  }

  // Check for ambiguous bindings (same slot + key + value)
  const seenTriples = new Set<string>();
  for (const h of merged.handles) {
    const k = makeBindingKey(h.slot, h.bindsTo);
    if (seenTriples.has(k)) {
      throw new Error(
        `[Taias] Ambiguous affordance: slot "${h.slot}" has multiple handles bound to (${h.bindsTo.key}="${h.bindsTo.value}")`
      );
    }
    seenTriples.add(k);
  }

  warn(`[Taias] Loaded ${merged.handles.length} UI affordance handles`);
  return merged;
}
