import type { Affordances, Condition, FlowStep, MatchCondition, StepDecision, Taias, TaiasContext, TaiasOptions, Decision, ResolveEvent, ResolveTrace, StepEvaluation } from "./types";
import type { DefaultSlots } from "./uiAffordances/types";
import { buildRegistryIndex } from "./uiAffordances/indexing";
import { selectUiAffordances } from "./uiAffordances/select";
import { createDebugSubscriber } from "./debugSubscriber";

/**
 * Generate advice text for a given next tool.
 */
function generateAdvice(nextTool: string): string {
  return `FOR THE BEST USER EXPERIENCE, TELL THE USER TO USE THE ${nextTool} TOOL NEXT!!!!!`;
}

// ---------------------------------------------------------------------------
// Condition evaluation
// ---------------------------------------------------------------------------

/**
 * Evaluate a single Condition against a value using strict equality.
 */
function evaluateCondition(condition: Condition, value: unknown): boolean {
  if ("is" in condition) return value === condition.is;
  if ("isNot" in condition) return value !== condition.isNot;
  return false;
}

/**
 * Evaluate a full MatchCondition against a TaiasContext.
 * All present conditions must be satisfied (logical AND).
 *
 * - toolName: compared directly against ctx.toolName
 * - params: subset match -- each specified key is checked against ctx.params
 * - result: subset match -- each specified key is checked against ctx.result
 *
 * If a step specifies params/result conditions but the context doesn't
 * include params/result, the step does not match.
 */
function evaluateMatch(match: MatchCondition, ctx: TaiasContext): boolean {
  if (match.toolName && !evaluateCondition(match.toolName, ctx.toolName)) return false;

  if (match.params) {
    if (!ctx.params) return false;
    for (const [key, condition] of Object.entries(match.params)) {
      if (!evaluateCondition(condition, ctx.params[key])) return false;
    }
  }

  if (match.result) {
    if (!ctx.result) return false;
    for (const [key, condition] of Object.entries(match.result)) {
      if (!evaluateCondition(condition, ctx.result[key])) return false;
    }
  }

  return true;
}

/**
 * Evaluate a full MatchCondition and return per-field breakdown.
 * Used when detailed tracing is enabled.
 */
function evaluateMatchDetailed(match: MatchCondition, ctx: TaiasContext): {
  passed: boolean;
  fieldResults: Record<string, { condition: Condition; actual: unknown; passed: boolean }>;
} {
  const fieldResults: Record<string, { condition: Condition; actual: unknown; passed: boolean }> = {};
  let allPassed = true;

  if (match.toolName) {
    const actual = ctx.toolName;
    const passed = evaluateCondition(match.toolName, actual);
    fieldResults["toolName"] = { condition: match.toolName, actual, passed };
    if (!passed) allPassed = false;
  }

  if (match.params) {
    if (!ctx.params) {
      for (const [key, condition] of Object.entries(match.params)) {
        fieldResults[`params.${key}`] = { condition, actual: undefined, passed: false };
      }
      allPassed = false;
    } else {
      for (const [key, condition] of Object.entries(match.params)) {
        const actual = ctx.params[key];
        const passed = evaluateCondition(condition, actual);
        fieldResults[`params.${key}`] = { condition, actual, passed };
        if (!passed) allPassed = false;
      }
    }
  }

  if (match.result) {
    if (!ctx.result) {
      for (const [key, condition] of Object.entries(match.result)) {
        fieldResults[`result.${key}`] = { condition, actual: undefined, passed: false };
      }
      allPassed = false;
    } else {
      for (const [key, condition] of Object.entries(match.result)) {
        const actual = ctx.result[key];
        const passed = evaluateCondition(condition, actual);
        fieldResults[`result.${key}`] = { condition, actual, passed };
        if (!passed) allPassed = false;
      }
    }
  }

  return { passed: allPassed, fieldResults };
}

// ---------------------------------------------------------------------------
// Per-field indexing
// ---------------------------------------------------------------------------

interface FieldIndex {
  valueMap: Map<unknown, number[]>;
  unconstrained: number[];
}

/**
 * Extract all `is` conditions from a match condition as field-path / value pairs.
 */
function extractIsConditions(match: MatchCondition): Array<{ path: string; value: unknown }> {
  const conditions: Array<{ path: string; value: unknown }> = [];
  if (match.toolName && "is" in match.toolName) {
    conditions.push({ path: "toolName", value: match.toolName.is });
  }
  if (match.params) {
    for (const [key, cond] of Object.entries(match.params)) {
      if ("is" in cond) conditions.push({ path: `params.${key}`, value: cond.is });
    }
  }
  if (match.result) {
    for (const [key, cond] of Object.entries(match.result)) {
      if ("is" in cond) conditions.push({ path: `result.${key}`, value: cond.is });
    }
  }
  return conditions;
}

/**
 * Check whether a match condition has a condition on a given field path.
 */
function hasConditionOnField(match: MatchCondition, path: string): boolean {
  if (path === "toolName") return !!match.toolName;
  if (path.startsWith("params.")) return !!match.params?.[path.slice(7)];
  if (path.startsWith("result.")) return !!match.result?.[path.slice(7)];
  return false;
}

/**
 * Get the value from a TaiasContext for a given field path.
 */
function getContextValue(ctx: TaiasContext, path: string): unknown {
  if (path === "toolName") return ctx.toolName;
  if (path.startsWith("params.")) return ctx.params?.[path.slice(7)];
  if (path.startsWith("result.")) return ctx.result?.[path.slice(7)];
  return undefined;
}

// ---------------------------------------------------------------------------
// Step access helpers
// ---------------------------------------------------------------------------

/**
 * Get the match condition from a FlowStep.
 *
 * - Logic-based steps: match comes from statement.match
 * - Handler-based steps (backwards compatibility): match is stored directly on the step
 */
function getMatch(step: FlowStep): MatchCondition {
  return step.kind === "logic" ? step.statement.match : step.match;
}

/**
 * Serialize a MatchCondition into a stable string for duplicate detection.
 */
function serializeMatch(match: MatchCondition): string {
  return JSON.stringify(match);
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
 *   Inputs -> Decision -> Manifestations
 *
 * are unified into a single resolve() call.
 *
 * @example
 * ```ts
 * const taias = createTaias({ flow, affordances });
 * ```
 */
export function createTaias<S extends string = DefaultSlots>(
  options: TaiasOptions<S>
): Taias<S> {
  const {
    flow,
    affordances,
    devMode = false,
    debug = false,
    tracing = "summary",
    onMissingStep,
    onWarn,
  } = options;

  const warn = onWarn ?? ((msg: string) => console.warn(msg));
  const detailed = tracing === "detailed";

  // Dev mode: Check for duplicate match conditions.
  if (devMode) {
    const seenKeys = new Set<string>();
    for (const step of flow.steps) {
      const key = serializeMatch(getMatch(step));
      if (seenKeys.has(key)) {
        throw new Error(
          `Taias: Duplicate match condition in flow '${flow.id}'. Each step must have a unique match condition. Duplicate: ${key}`
        );
      }
      seenKeys.add(key);
    }
  }

  // -----------------------------------------------------------------------
  // Build per-field indexes
  // -----------------------------------------------------------------------

  const fieldIndexes = new Map<string, FieldIndex>();
  const indexableStepIndices: number[] = [];
  const broadStepIndices: number[] = [];

  for (let i = 0; i < flow.steps.length; i++) {
    const match = getMatch(flow.steps[i]);
    const isConditions = extractIsConditions(match);

    if (isConditions.length === 0) {
      broadStepIndices.push(i);
      continue;
    }

    indexableStepIndices.push(i);

    for (const { path, value } of isConditions) {
      let fieldIndex = fieldIndexes.get(path);
      if (!fieldIndex) {
        fieldIndex = { valueMap: new Map(), unconstrained: [] };
        fieldIndexes.set(path, fieldIndex);
      }
      let stepList = fieldIndex.valueMap.get(value);
      if (!stepList) {
        stepList = [];
        fieldIndex.valueMap.set(value, stepList);
      }
      stepList.push(i);
    }
  }

  // Build unconstrained sets: for each field index, find indexable steps
  // that don't have a condition on that field.
  for (const [fieldPath, fieldIndex] of fieldIndexes) {
    for (const i of indexableStepIndices) {
      if (!hasConditionOnField(getMatch(flow.steps[i]), fieldPath)) {
        fieldIndex.unconstrained.push(i);
      }
    }
  }

  const hasBroadSteps = broadStepIndices.length > 0;

  // Build affordance index once (if provided)
  const registryIndex = buildRegistryIndex<S>(affordances);

  // -----------------------------------------------------------------------
  // Event emitter
  // -----------------------------------------------------------------------

  const listeners = new Map<string, Set<Function>>();

  function emit<E extends string>(event: E, data: unknown): void {
    const handlers = listeners.get(event);
    if (handlers) {
      for (const handler of handlers) handler(data);
    }
  }

  function on(event: string, handler: Function): void {
    let set = listeners.get(event);
    if (!set) {
      set = new Set();
      listeners.set(event, set);
    }
    set.add(handler);
  }

  function off(event: string, handler: Function): void {
    listeners.get(event)?.delete(handler);
  }

  if (debug) {
    const debugOpts = typeof debug === "object" ? debug : undefined;
    on("resolve", createDebugSubscriber(debugOpts));
  }

  return {
    async resolve(ctx: TaiasContext): Promise<Affordances<S> | null> {
      const startTime = performance.now();
      const timestamp = Date.now();

      let matchedStep: FlowStep | undefined;
      let matchedStepIndex: number | null = null;
      let matchPhase: "indexed" | "broad" | null = null;
      const resolutionPath: string[] = [];
      let candidatesEvaluated = 0;
      const evaluations: StepEvaluation[] | undefined = detailed ? [] : undefined;

      // Evaluate a candidate step and track it for tracing.
      // In detailed mode, uses evaluateMatchDetailed to capture per-field
      // outcomes; in summary mode, uses the cheaper evaluateMatch.
      function tryMatch(idx: number): boolean {
        candidatesEvaluated++;
        const step = flow.steps[idx];
        const match = getMatch(step);

        if (detailed) {
          const { passed, fieldResults } = evaluateMatchDetailed(match, ctx);
          evaluations!.push({
            stepIndex: idx,
            match,
            result: passed ? "matched" : "no-match",
            fieldResults,
          });
          return passed;
        }

        return evaluateMatch(match, ctx);
      }

      // Phase 1: Find candidates from per-field indexes via intersection
      const applicableFieldPaths: string[] = [];
      for (const fieldPath of fieldIndexes.keys()) {
        const ctxValue = getContextValue(ctx, fieldPath);
        if (ctxValue !== undefined) {
          applicableFieldPaths.push(fieldPath);
        }
      }

      resolutionPath.push(...applicableFieldPaths);

      if (applicableFieldPaths.length > 0) {
        // Build candidate sets for each applicable field and intersect
        let candidates: Set<number> | null = null;

        for (const fieldPath of applicableFieldPaths) {
          const fieldIndex = fieldIndexes.get(fieldPath)!;
          const ctxValue = getContextValue(ctx, fieldPath);

          const fieldCandidates = new Set<number>();

          // Indexed matches for this field's value
          const indexed = fieldIndex.valueMap.get(ctxValue);
          if (indexed) {
            for (const idx of indexed) fieldCandidates.add(idx);
          }

          // Unconstrained steps (don't care about this field)
          for (const idx of fieldIndex.unconstrained) {
            fieldCandidates.add(idx);
          }

          if (candidates === null) {
            candidates = fieldCandidates;
          } else {
            // Intersect
            for (const idx of candidates) {
              if (!fieldCandidates.has(idx)) candidates.delete(idx);
            }
          }
        }

        // Evaluate full conditions on narrowed candidates (definition order)
        if (candidates && candidates.size > 0) {
          const sorted = [...candidates].sort((a, b) => a - b);
          for (const idx of sorted) {
            if (tryMatch(idx)) {
              matchedStep = flow.steps[idx];
              matchedStepIndex = idx;
              matchPhase = "indexed";
              break;
            }
          }
        }
      } else if (indexableStepIndices.length > 0) {
        // Context has no fields that match any index -- evaluate all
        // indexable steps that are unconstrained on everything
        // (i.e., steps with is conditions on fields not present in context).
        // evaluateMatch handles this correctly.
        for (const idx of indexableStepIndices) {
          if (tryMatch(idx)) {
            matchedStep = flow.steps[idx];
            matchedStepIndex = idx;
            matchPhase = "indexed";
            break;
          }
        }
      }

      // Phase 2: If no indexed match, evaluate broad steps
      if (!matchedStep && hasBroadSteps) {
        for (const idx of broadStepIndices) {
          if (tryMatch(idx)) {
            matchedStep = flow.steps[idx];
            matchedStepIndex = idx;
            matchPhase = "broad";
            break;
          }
        }
      }

      // Construct the trace and emit event on every exit path (no-match,
      // handler-returns-null, and successful match). Subscribers always
      // get complete visibility into every resolve() call.
      const trace: ResolveTrace = {
        matched: !!matchedStep,
        matchedStepIndex,
        matchedStepKind: matchedStep?.kind ?? null,
        matchedStepMatch: matchedStep ? getMatch(matchedStep) : null,
        phase: matchPhase,
        resolutionPath,
        candidatesEvaluated,
        ...(evaluations !== undefined ? { evaluations } : {}),
      };

      if (!matchedStep) {
        onMissingStep?.(ctx);

        emit("resolve", {
          flowId: flow.id,
          timestamp,
          durationMs: performance.now() - startTime,
          context: ctx,
          trace,
          decision: null,
          affordances: null,
        } satisfies ResolveEvent<S>);

        return null;
      }

      // Evaluate the step based on its kind
      let result: StepDecision | null;

      if (matchedStep.kind === "logic") {
        result = matchedStep.statement.decision;
      } else {
        result = await matchedStep.handler(ctx);
      }

      if (!result) {
        emit("resolve", {
          flowId: flow.id,
          timestamp,
          durationMs: performance.now() - startTime,
          context: ctx,
          trace,
          decision: null,
          affordances: null,
        } satisfies ResolveEvent<S>);

        return null;
      }

      if (devMode && result.nextTool === "") {
        warn(`Taias: nextTool for tool '${ctx.toolName}' is empty.`);
      }

      const decision: Decision = { ...result };

      const selections = selectUiAffordances<S>(decision, registryIndex, {
        devMode,
        onWarn: warn,
      });

      const advice = generateAdvice(result.nextTool);

      emit("resolve", {
        flowId: flow.id,
        timestamp,
        durationMs: performance.now() - startTime,
        context: ctx,
        trace,
        decision,
        affordances: { advice, selections },
      } satisfies ResolveEvent<S>);

      return { advice, decision, selections };
    },

    on: on as Taias<S>["on"],
    off: off as Taias<S>["off"],
  };
}
