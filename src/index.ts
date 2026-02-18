// Main exports
export { defineFlow } from "./flow";
export { createTaias } from "./createTaias";

// UI affordances exports
export { defineAffordances } from "./uiAffordances/defineAffordances";
export { mergeAffordances } from "./uiAffordances/mergeAffordances";
export type { AffordanceRegistrar } from "./uiAffordances/defineAffordances";
export type {
  DefaultSlots,
  CanonicalSlot,
  Binding,
  BindingInput,
  HandleRegistration,
  Selection,
  UiSelections,
  AffordanceRegistry,
} from "./uiAffordances/types";

// Core + flow type exports
export type {
  Condition,
  FieldCondition,
  Decision,
  TaiasContext,
  StepDecision,
  Affordances,
  StepHandler,
  StepInput,
  MatchCondition,
  LogicStatement,
  FlowStep,
  FlowDefinition,
  FlowBuilder,
  TaiasOptions,
  Taias,
} from "./types";
