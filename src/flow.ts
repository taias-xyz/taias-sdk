import type { FlowBuilder, FlowDefinition, FlowStep, MatchCondition, StepInput } from "./types";

/**
 * Define a flow with its steps.
 *
 * @param flowId - Unique identifier for the flow
 * @param builder - Callback that receives a FlowBuilder to define steps
 * @returns A FlowDefinition object
 *
 * @example Logic statement with match condition object
 * ```ts
 * const onboardRepoFlow = defineFlow("onboard_repo", (flow) => {
 *   flow.step({ toolName: "scan_repo" }, { nextTool: "configure_app" });
 * });
 * ```
 *
 * @example Backwards compatibility
 * A string match and handler functions are also supported:
 * ```ts
 * flow.step("scan_repo", { nextTool: "configure_app" }); // string is sugar for { toolName: "scan_repo" }
 * flow.step("scan_repo", (ctx) => ({ nextTool: "configure_app" })); // handler function
 * ```
 */
export function defineFlow(
  flowId: string,
  builder: (flow: FlowBuilder) => void
): FlowDefinition {
  const steps: FlowStep[] = [];

  const flowBuilder: FlowBuilder = {
    step(match: string | MatchCondition, input: StepInput): void {
      // Normalize: string is sugar for { toolName: string }
      const condition: MatchCondition =
        typeof match === "string" ? { toolName: match } : match;

      if (typeof input === "function") {
        // Handler function -- backwards-compatible escape hatch.
        // The match condition is stored alongside the handler since
        // the function itself has no formal match conditions.
        steps.push({ kind: "handler", match: condition, handler: input });
      } else {
        // Static logic statement -- the core primitive.
        // The statement is the sole source of truth for its match
        // conditions and decision.
        steps.push({
          kind: "logic",
          statement: {
            match: condition,
            decision: input,
          },
        });
      }
    },
  };

  builder(flowBuilder);

  return {
    id: flowId,
    steps,
  };
}

