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
 * - { is: value }    -- exact equality (field === value)
 * - { isNot: value } -- not equal      (field !== value)
 *
 * Condition accepts unknown values, enabling matching on strings, numbers,
 * booleans, and any other value type. Comparison uses strict equality (===).
 *
 * The operator system is pure data (not wrapper functions), aligning with
 * the logic-as-data philosophy. New operators (oneOf, contains, etc.) can
 * be added as union members without changing the evaluation architecture.
 */
export type Condition =
  | { is: unknown }
  | { isNot: unknown };

// ---------------------------------------------------------------------------
// Logic statements
// ---------------------------------------------------------------------------

/**
 * Match condition for a logic statement.
 *
 * All fields are optional -- steps can match on any combination of
 * toolName, params, and result. Each field uses explicit Condition
 * operators ({ is: ... } or { isNot: ... }).
 *
 * For params and result, conditions are specified per-key. Only the
 * specified keys are checked (subset matching); unspecified keys are
 * ignored. If a step specifies a params/result condition but the
 * context doesn't include params/result, the step does not match.
 */
export type MatchCondition = {
  toolName?: Condition;
  params?: Record<string, Condition>;
  result?: Record<string, Condition>;
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
 *     this step applies. All fields use explicit operator objects.
 *   - input: a StepDecision object (creates a logic statement).
 *     A StepHandler function is also accepted for backwards compatibility.
 */
export interface FlowBuilder {
  step(match: MatchCondition, input: StepInput): void;
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
