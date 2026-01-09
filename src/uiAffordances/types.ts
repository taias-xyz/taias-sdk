export type CanonicalSlot = "primaryCta" | "secondaryCta" | "widgetVariant";

export type Binding = {
  key: string;
  value: string;
};

/**
 * Input format for registering affordance bindings.
 * - { toolName } is shorthand for { key: "nextTool", value: toolName }
 * - { key, value } is the generalized form for custom bindings
 */
export type BindingInput = { toolName: string } | { key: string; value: string };

export type HandleRegistration = {
  slot: CanonicalSlot;
  handleId: string;
  bindsTo: Binding;
};

export type Selection = {
  handleId: string;
  bindsTo: Binding;
};

export type UiSelections = Partial<Record<CanonicalSlot, Selection>>;

export type AffordanceRegistry = {
  handles: HandleRegistration[];
};

export type SlotMatch = Partial<Record<CanonicalSlot, string>>;

export function normalizeBinding(input: BindingInput): Binding {
  if ("toolName" in input) return { key: "nextTool", value: input.toolName };
  return { key: input.key, value: input.value };
}

export function makeBindingKey(slot: CanonicalSlot, binding: Binding): string {
  return `${slot}::${binding.key}::${binding.value}`;
}
