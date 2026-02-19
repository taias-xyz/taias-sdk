import type { Affordances, Condition, FieldCondition, FlowStep, MatchCondition, StepDecision, Taias, TaiasContext, TaiasOptions, Decision } from "./types";
import type { DefaultSlots } from "./uiAffordances/types";
import { buildRegistryIndex } from "./uiAffordances/indexing";
import { selectUiAffordances } from "./uiAffordances/select";

/**
 * Generate advice text for a given next tool.
 */
function generateAdvice(nextTool: string): string {
  return `FOR THE BEST USER EXPERIENCE, TELL THE USER TO USE THE ${nextTool} TOOL NEXT!!!!!`;
}

// ---------------------------------------------------------------------------
// Condition normalization and evaluation
// ---------------------------------------------------------------------------

/**
 * Normalize a FieldCondition to a canonical Condition object.
 * A bare string is sugar for { is: string }.
 */
function normalizeFieldCondition(field: FieldCondition): Condition {
  return typeof field === "string" ? { is: field } : field;
}

/**
 * Evaluate a single Condition against a value.
 */
function evaluateCondition(condition: Condition, value: string): boolean {
  if ("is" in condition) return value === condition.is;
  if ("isNot" in condition) return value !== condition.isNot;
  return false;
}

/**
 * Evaluate a full MatchCondition against a TaiasContext.
 * All conditions in the match must be satisfied.
 */
function evaluateMatch(match: MatchCondition, ctx: TaiasContext): boolean {
  const toolCondition = normalizeFieldCondition(match.toolName);
  return evaluateCondition(toolCondition, ctx.toolName);
}

/**
 * Check whether a FieldCondition is indexable (i.e., uses the `is` operator).
 * Indexable conditions enable O(1) Map lookup at resolve time.
 */
function isIndexable(field: FieldCondition): boolean {
  if (typeof field === "string") return true;
  return "is" in field;
}

/**
 * Extract the index key from an indexable FieldCondition.
 * Only call this when isIndexable() returns true.
 */
function indexKey(field: FieldCondition): string {
  if (typeof field === "string") return field;
  if ("is" in field) return field.is;
  throw new Error("Cannot derive index key from non-indexable condition");
}

// ---------------------------------------------------------------------------
// Step access helpers
// ---------------------------------------------------------------------------

/**
 * Get the match condition from a FlowStep.
 *
 * - Logic-based steps: match comes from statement.match (the statement is
 *   the sole source of truth for its match conditions)
 * - Handler-based steps (backwards compatibility): match is stored directly on the step
 */
function getMatch(step: FlowStep): MatchCondition {
  return step.kind === "logic" ? step.statement.match : step.match;
}

/**
 * Serialize a MatchCondition into a stable string for duplicate detection.
 * Normalizes sugar forms so that equivalent conditions produce the same key.
 */
function serializeMatch(match: MatchCondition): string {
  const normalized = normalizeFieldCondition(match.toolName);
  return JSON.stringify({ toolName: normalized });
}

/**
 * createTaias constructs a decision engine.
 *
 * Taias resolves context into a generalized Decision object,
 * and then manifests that decision into concrete affordances:
 *
 *   - LLM guidance (advice)
 *   - UI affordance selections
 *
 * Flow logic is expressed as logic statements -- structured data that
 * Taias understands. (Handler functions remain as a backwards-compatible
 * escape hatch.)
 * 
 * Flow logic determines *what should happen next*.
 * UI affordances determine *how that decision appears in the interface*.
 *
 * This file is the boundary where:
 *
 *   Inputs → Decision → Manifestations
 *
 * are unified into a single resolve() call.
 *
 * @example Default slots (backwards compatible)
 * ```ts
 * const taias = createTaias({ flow, affordances });
 * ```
 *
 * @example Custom slots (fully type-safe)
 * ```ts
 * type MySlots = "primaryCta" | "contentArea" | "headerStyle";
 * const affordances = defineAffordances<MySlots>((r) => {
 *   r.primaryCta("cta", { key: "nextTool", value: "createUser" });
 *   r.contentArea("content", { key: "contentArea", value: "form" });
 *   r.headerStyle("header", { key: "headerStyle", value: "progress" });
 * });
 * const taias = createTaias<MySlots>({ flow, affordances });
 * ```
 */
export function createTaias<S extends string = DefaultSlots>(
  options: TaiasOptions<S>
): Taias<S> {
  const {
    flow,
    affordances,
    devMode = false,
    onMissingStep,
    onWarn,
  } = options;

  const warn = onWarn ?? ((msg: string) => console.warn(msg));

  // Dev mode: Check for duplicate match conditions.
  // Two steps with structurally identical normalized conditions are duplicates.
  if (devMode) {
    const seenKeys = new Set<string>();
    for (const step of flow.steps) {
      const key = serializeMatch(getMatch(step));
      if (seenKeys.has(key)) {
        const match = getMatch(step);
        const normalized = normalizeFieldCondition(match.toolName);
        const label = "is" in normalized ? normalized.is : `isNot:${normalized.isNot}`;
        throw new Error(
          `Taias: Duplicate match condition '${label}' in flow '${flow.id}'. Each step must have a unique match condition.`
        );
      }
      seenKeys.add(key);
    }
  }

  // Build internal indexes for efficient resolution.
  //
  // Steps with indexable conditions (is / string sugar) go into an exact
  // Map for O(1) lookup. Steps with non-indexable conditions (isNot) go
  // into a separate list. When no broad steps exist, resolve uses the
  // fast path (Map only). When broad steps exist, resolve evaluates all
  // steps in definition order.
  //
  // This indexing is a performance optimization derived from the current
  // set of operators, not a permanent architectural choice. It will evolve
  // as operators and match condition fields expand.
  const exactIndex = new Map<string, FlowStep>();
  const broadSteps: FlowStep[] = [];

  for (const step of flow.steps) {
    const match = getMatch(step);
    if (isIndexable(match.toolName)) {
      exactIndex.set(indexKey(match.toolName), step);
    } else {
      broadSteps.push(step);
    }
  }

  const hasBroadSteps = broadSteps.length > 0;

  // Build affordance index once (if provided)
  const registryIndex = buildRegistryIndex<S>(affordances);

  return {
    async resolve(ctx: TaiasContext): Promise<Affordances<S> | null> {
      let step: FlowStep | undefined;

      if (!hasBroadSteps) {
        // Fast path: all steps use indexable conditions (is / string sugar).
        // O(1) Map lookup -- same performance as before operators were introduced.
        step = exactIndex.get(ctx.toolName);
      } else {
        // Full evaluation: some steps use non-indexable conditions (isNot).
        // Evaluate all steps in definition order; first match wins.
        for (const candidate of flow.steps) {
          if (evaluateMatch(getMatch(candidate), ctx)) {
            step = candidate;
            break;
          }
        }
      }

      if (!step) {
        onMissingStep?.(ctx);
        return null;
      }

      // Evaluate the step based on its kind:
      // - Logic statements: return the decision directly (no function call)
      // - Handler functions (backwards compatibility): call the handler and await the result
      let result: StepDecision | null;

      if (step.kind === "logic") {
        result = step.statement.decision;
      } else {
        result = await step.handler(ctx);
      }

      if (!result) return null;

      if (devMode && result.nextTool === "") {
        warn(`Taias: nextTool for tool '${ctx.toolName}' is empty.`);
      }

      // Build decision object from flow result (spread all fields)
      const decision: Decision = { ...result };

      // Compute UI selections (may be empty if no registry passed)
      const selections = selectUiAffordances<S>(decision, registryIndex, {
        devMode,
        onWarn: warn,
      });

      return {
        advice: generateAdvice(result.nextTool),
        decision,
        selections,
      };
    },
  };
}
