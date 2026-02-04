/**
 * Default slots for backwards compatibility.
 * Users can define custom slots by passing a type parameter.
 */
export type DefaultSlots = "primaryCta" | "secondaryCta" | "widgetVariant";

/**
 * Alias for backwards compatibility in exports.
 * @deprecated Use DefaultSlots or define your own slot type
 */
export type CanonicalSlot = DefaultSlots;

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

/**
 * A registered UI affordance handle.
 * Generic over slot type S for custom slot support.
 */
export type HandleRegistration<S extends string = DefaultSlots> = {
  slot: S;
  handleId: string;
  bindsTo: Binding;
};

export type Selection = {
  handleId: string;
  bindsTo: Binding;
};

/**
 * UI selections keyed by slot name.
 * Generic over slot type S for custom slot support.
 */
export type UiSelections<S extends string = DefaultSlots> = Partial<Record<S, Selection>>;

/**
 * Collection of registered handles.
 * Generic over slot type S for custom slot support.
 */
export type AffordanceRegistry<S extends string = DefaultSlots> = {
  handles: HandleRegistration<S>[];
};

/**
 * Mapping of slots to decision fields.
 * Generic over slot type S for custom slot support.
 */
export type SlotMatch<S extends string = DefaultSlots> = Partial<Record<S, string>>;

export function normalizeBinding(input: BindingInput): Binding {
  if ("toolName" in input) return { key: "nextTool", value: input.toolName };
  return { key: input.key, value: input.value };
}

/**
 * Creates a binding key for indexing.
 * Accepts any string for slot to support custom slots.
 */
export function makeBindingKey(slot: string, binding: Binding): string {
  return `${slot}::${binding.key}::${binding.value}`;
}
