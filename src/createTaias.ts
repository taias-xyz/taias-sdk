import type { Affordances, Taias, TaiasContext, TaiasOptions, Decision } from "./types";
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
 * createTaias constructs a decision engine.
 *
 * Taias resolves tool context into a generalized Decision object,
 * and then manifests that decision into concrete affordances:
 *
 *   - LLM guidance (advice)
 *   - UI affordance selections
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
 * const taias = createTaias<MySlots>({
 *   flow,
 *   affordances,
 *   slotMatch: { contentArea: "contentArea", headerStyle: "headerStyle" },
 * });
 * ```
 */
export function createTaias<S extends string = DefaultSlots>(
  options: TaiasOptions<S>
): Taias<S> {
  const {
    flow,
    affordances,
    slotMatch,
    devMode = false,
    onMissingStep,
    onWarn,
  } = options;

  const warn = onWarn ?? ((msg: string) => console.warn(msg));

  // Dev mode: Check for duplicate toolNames
  if (devMode) {
    const seenTools = new Set<string>();
    for (const step of flow.steps) {
      if (seenTools.has(step.toolName)) {
        throw new Error(
          `Taias: Duplicate step for tool '${step.toolName}' in flow '${flow.id}'. Only one handler per tool is supported.`
        );
      }
      seenTools.add(step.toolName);
    }
  }

  // Build a lookup map for efficient resolution
  const stepMap = new Map(flow.steps.map((step) => [step.toolName, step.handler]));

  // Build affordance index once (if provided)
  const registryIndex = buildRegistryIndex<S>(affordances);

  return {
    async resolve(ctx: TaiasContext): Promise<Affordances<S> | null> {
      const handler = stepMap.get(ctx.toolName);

      if (!handler) {
        onMissingStep?.(ctx);
        return null;
      }

      const result = await handler(ctx);
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
        slotMatch,
      });

      return {
        advice: generateAdvice(result.nextTool),
        decision,
        selections,
      };
    },
  };
}
