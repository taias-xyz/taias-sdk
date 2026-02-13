import type {
  AffordanceRegistry,
  DefaultSlots,
  UiSelections,
} from "./uiAffordances/types";

/**
 * Generalized decision object.
 * Contains nextTool plus any custom fields returned by step handlers.
 */
export type Decision = Record<string, string | undefined>;

/**
 * Context passed to a step handler.
 *
 * - toolName: the name of the tool being executed
 * - params: the input parameters of the tool call (optional)
 * - result: the output of the tool's execution (optional)
 */
export type TaiasContext = {
  toolName: string;
  params?: Record<string, unknown>;
  result?: Record<string, unknown>;
};

/**
 * Decision returned by a step handler specifying the next tool.
 * Additional custom fields can be included for multi-dimensional UI control.
 */
export type StepDecision = {
  nextTool: string;
  [key: string]: string;
};

/**
 * Affordances returned by resolve():
 * - advice: LLM guidance text
 * - decision: generalized decision object (contains nextTool + custom fields)
 * - selections: UI affordance selections (may be empty)
 *
 * Generic over slot type S for custom slot support.
 */
export type Affordances<S extends string = DefaultSlots> = {
  advice: string;
  decision: Decision;
  selections: UiSelections<S>;
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
 * Generic over slot type S for custom slot support.
 */
export type TaiasOptions<S extends string = DefaultSlots> = {
  flow: FlowDefinition;
  affordances?: AffordanceRegistry<S>;
  devMode?: boolean;
  onMissingStep?: (ctx: TaiasContext) => void;
  onWarn?: (msg: string) => void;
};

/**
 * The Taias instance interface.
 * Generic over slot type S for custom slot support.
 */
export interface Taias<S extends string = DefaultSlots> {
  resolve(ctx: TaiasContext): Affordances<S> | null | Promise<Affordances<S> | null>;
}
