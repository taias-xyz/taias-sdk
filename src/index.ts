// Main exports
export { defineFlow } from "./flow";
export { createTaias } from "./createTaias";

// UI affordances exports
export { defineAffordances } from "./uiAffordances/defineAffordances";
export { mergeAffordances } from "./uiAffordances/mergeAffordances";
export type {
  CanonicalSlot,
  Binding,
  BindingInput,
  HandleRegistration,
  Selection,
  UiSelections,
  AffordanceRegistry,
  SlotMatch,
} from "./uiAffordances/types";

// Core + flow type exports
export type {
  Decision, // moved to core
  TaiasContext,
  StepDecision,
  Affordances,
  StepHandler,
  FlowStep,
  FlowDefinition,
  FlowBuilder,
  TaiasOptions,
  Taias,
} from "./types";
