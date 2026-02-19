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

// ---------------------------------------------------------------------------
// Operators
// ---------------------------------------------------------------------------

/**
 * A condition operator applied to a single field value.
 *
 * - { is: "value" }    -- exact equality (field === value)
 * - { isNot: "value" } -- not equal    (field !== value)
 *
 * The operator system is pure data (not wrapper functions), aligning with
 * the logic-as-data philosophy. New operators (oneOf, contains, etc.) can
 * be added as union members without changing the evaluation architecture.
 */
export type Condition =
  | { is: string }
  | { isNot: string };

/**
 * A field condition is either:
 * - A bare string: sugar for { is: string }
 * - An explicit Condition object
 */
export type FieldCondition = string | Condition;

// ---------------------------------------------------------------------------
// Logic statements
// ---------------------------------------------------------------------------

/**
 * Match condition for a logic statement.
 *
 * Each field accepts a FieldCondition -- either a bare value (sugar for
 * { is: value }) or an explicit operator object ({ is: ... }, { isNot: ... }).
 *
 * Designed to expand with additional fields (params, result, state, etc.).
 */
export type MatchCondition = {
  toolName: FieldCondition;
};

/**
 * A declarative logic statement -- the core primitive of the decision engine.
 *
 * Formalizes the implicit "Given X, then Y" logic into structured data
 * that Taias can understand, validate, and optimize.
 *
 * - match: the conditions under which this statement applies
 * - decision: the decision to produce when matched
 */
export type LogicStatement = {
  match: MatchCondition;
  decision: StepDecision;
};

// ---------------------------------------------------------------------------
// Flow steps
// ---------------------------------------------------------------------------

/**
 * A step within a flow. Discriminated union:
 *
 * - "logic": A declarative logic statement. The statement is the sole source
 *   of truth for its match conditions and decision.
 * - "handler": A handler function (backwards-compatible escape hatch).
 *   The match condition is stored alongside the handler since the function
 *   itself has no formal match conditions.
 */
export type FlowStep =
  | { kind: "logic"; statement: LogicStatement }
  | { kind: "handler"; match: MatchCondition; handler: StepHandler };

/**
 * A complete flow definition with an id and its steps.
 */
export type FlowDefinition = {
  id: string;
  steps: Array<FlowStep>;
};

/**
 * The input accepted by flow.step() -- either a handler function
 * or a static StepDecision object.
 */
export type StepInput = StepHandler | StepDecision;

/**
 * Builder interface for defining flow steps.
 *
 * step() takes two arguments:
 *   - match: a MatchCondition object describing the conditions under which
 *     this step applies. A string is sugar for { toolName: string }.
 *   - input: a StepDecision object (creates a logic statement).
 *     A StepHandler function is also accepted for backwards compatibility.
 */
export interface FlowBuilder {
  step(match: string | MatchCondition, input: StepInput): void;
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
