// Main exports
export { defineFlow } from "./flow";
export { createTaias } from "./createTaias";

// Observability exports
export { createDebugSubscriber } from "./debugSubscriber";

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
  ResolveEvent,
  ResolveTrace,
  StepEvaluation,
  TaiasEventMap,
} from "./types";
