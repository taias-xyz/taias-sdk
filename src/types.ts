import type {
  AffordanceRegistry,
  SlotMatch,
  UiSelections,
} from "./uiAffordances/types";

/**
 * Generalized decision object.
 * Currently uses decision.nextTool. The structure supports additional keys.
 */
export type Decision = Record<string, string | undefined>;

/**
 * Context passed to a step handler.
 */
export type TaiasContext = {
  toolName: string;
};

/**
 * Decision returned by a step handler specifying the next tool.
 */
export type StepDecision = {
  nextTool: string;
};

/**
 * Affordances returned by resolve():
 * - advice: LLM guidance text
 * - decision: generalized decision object (currently includes nextTool)
 * - selections: UI affordance selections (may be empty)
 */
export type Affordances = {
  advice: string;
  decision: Decision;
  selections: UiSelections;
};

/**
 * Handler function for a flow step.
 * Can return synchronously or asynchronously.
 */
export type StepHandler = (
  ctx: TaiasContext
) => StepDecision | null | Promise<StepDecision | null>;

/**
 * A step within a flow, mapping a tool name to its handler.
 */
export type FlowStep = {
  toolName: string;
  handler: StepHandler;
};

/**
 * A complete flow definition with an id and its steps.
 */
export type FlowDefinition = {
  id: string;
  steps: Array<FlowStep>;
};

/**
 * Builder interface for defining flow steps.
 */
export interface FlowBuilder {
  step(toolName: string, handler: StepHandler): void;
}

/**
 * Options for creating a Taias instance.
 */
export type TaiasOptions = {
  flow: FlowDefinition;
  affordances?: AffordanceRegistry;
  slotMatch?: SlotMatch;
  devMode?: boolean;
  onMissingStep?: (ctx: TaiasContext) => void;
  onWarn?: (msg: string) => void;
};

/**
 * The Taias instance interface.
 */
export interface Taias {
  resolve(ctx: TaiasContext): Affordances | null | Promise<Affordances | null>;
}
