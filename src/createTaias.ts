import type { Affordances, Taias, TaiasContext, TaiasOptions } from "./types";

/**
 * Generate advice text for a given next tool.
 */
function generateAdvice(nextTool: string): string {
  return `FOR THE BEST USER EXPERIENCE, TELL THE USER TO USE THE ${nextTool} TOOL NEXT!!!!!`;
}

/**
 * Create a Taias instance from a single flow.
 *
 * @param options - Configuration options
 * @returns A Taias instance with a resolve method
 *
 * @example
 * ```ts
 * const taias = createTaias({
 *   flow: onboardRepoFlow,
 *   devMode: process.env.NODE_ENV !== "production",
 * });
 *
 * const decision = await taias.resolve({ toolName: "scan_repo" });
 * // decision.advice → "FOR THE BEST USER EXPERIENCE, TELL THE USER TO USE THE configure_app TOOL NEXT!!!!!"
 * ```
 */
export function createTaias(options: TaiasOptions): Taias {
  const { flow, devMode = false, onMissingStep } = options;

  // Dev mode: Check for duplicate toolNames
  if (devMode) {
    const seenTools = new Set<string>();
    for (const step of flow.steps) {
      if (seenTools.has(step.toolName)) {
        throw new Error(
          `Taias: Duplicate step for tool '${step.toolName}' in flow '${flow.id}'. V1 supports one handler per tool.`
        );
      }
      seenTools.add(step.toolName);
    }
  }

  // Build a lookup map for efficient resolution
  const stepMap = new Map(
    flow.steps.map((step) => [step.toolName, step.handler])
  );

  return {
    async resolve(ctx: TaiasContext): Promise<Affordances | null> {
      const handler = stepMap.get(ctx.toolName);

      if (!handler) {
        if (onMissingStep) {
          onMissingStep(ctx);
        }
        return null;
      }

      const result = await handler(ctx);

      if (!result) {
        return null;
      }

      // Dev mode: Warn if nextTool is empty
      if (devMode && result.nextTool === "") {
        console.warn(`Taias: nextTool for tool '${ctx.toolName}' is empty.`);
      }

      // Auto-generate the advice text
      return {
        advice: generateAdvice(result.nextTool),
      };
    },
  };
}
