import type { Affordances, FlowStep, MatchCondition, StepDecision, Taias, TaiasContext, TaiasOptions, Decision } from "./types";
import type { DefaultSlots } from "./uiAffordances/types";
import { buildRegistryIndex } from "./uiAffordances/indexing";
import { selectUiAffordances } from "./uiAffordances/select";

/**
 * Generate advice text for a given next tool.
 */
function generateAdvice(nextTool: string): string {
  return `FOR THE BEST USER EXPERIENCE, TELL THE USER TO USE THE ${nextTool} TOOL NEXT!!!!!`;
}

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
 * Derive an index key from a match condition.
 *
 * Currently all match conditions use toolName, so the key is simply
 * the toolName value. When match conditions gain additional fields,
 * this function will evolve to produce compound keys or the indexing
 * strategy will change entirely.
 */
function deriveIndexKey(match: MatchCondition): string {
  return match.toolName;
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

  // Dev mode: Check for duplicate match conditions
  if (devMode) {
    const seenKeys = new Set<string>();
    for (const step of flow.steps) {
      const key = deriveIndexKey(getMatch(step));
      if (seenKeys.has(key)) {
        throw new Error(
          `Taias: Duplicate match condition '${key}' in flow '${flow.id}'. Each step must have a unique match condition.`
        );
      }
      seenKeys.add(key);
    }
  }

  // Build an internal index for efficient resolution.
  //
  // Currently all match conditions use toolName as the sole field, so a
  // Map keyed by toolName is the right index. This is a performance
  // optimization derived from the current set of match conditions, not a
  // permanent architectural choice -- it will evolve when match conditions
  // gain additional fields.
  const stepIndex = new Map<string, FlowStep>();
  for (const step of flow.steps) {
    stepIndex.set(deriveIndexKey(getMatch(step)), step);
  }

  // Build affordance index once (if provided)
  const registryIndex = buildRegistryIndex<S>(affordances);

  return {
    async resolve(ctx: TaiasContext): Promise<Affordances<S> | null> {
      // Find the step whose match conditions are satisfied by the context.
      // Currently, match conditions only contain toolName, so we use the
      // index keyed by toolName. When match conditions expand, this lookup
      // will evolve to evaluate all relevant conditions.
      const step = stepIndex.get(ctx.toolName);

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
