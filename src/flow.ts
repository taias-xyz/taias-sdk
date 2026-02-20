import type { FlowBuilder, FlowDefinition, FlowStep, MatchCondition, StepInput } from "./types";

/**
 * Define a flow with its steps.
 *
 * @param flowId - Unique identifier for the flow
 * @param builder - Callback that receives a FlowBuilder to define steps
 * @returns A FlowDefinition object
 *
 * @example Logic statement matching on toolName
 * ```ts
 * const onboardRepoFlow = defineFlow("onboard_repo", (flow) => {
 *   flow.step({ toolName: { is: "scan_repo" } }, { nextTool: "configure_app" });
 * });
 * ```
 *
 * @example Matching on params and result
 * ```ts
 * flow.step(
 *   { toolName: { is: "scan_repo" }, params: { language: { is: "python" } } },
 *   { nextTool: "configure_python" },
 * );
 * flow.step(
 *   { result: { hasConfig: { is: true } } },
 *   { nextTool: "review_config" },
 * );
 * ```
 *
 * @example isNot operator
 * ```ts
 * flow.step({ toolName: { isNot: "abort_session" } }, { nextTool: "continue_flow" });
 * ```
 */
export function defineFlow(
  flowId: string,
  builder: (flow: FlowBuilder) => void
): FlowDefinition {
  const steps: FlowStep[] = [];

  const flowBuilder: FlowBuilder = {
    step(match: MatchCondition, input: StepInput): void {
      if (typeof input === "function") {
        steps.push({ kind: "handler", match, handler: input });
      } else {
        steps.push({
          kind: "logic",
          statement: {
            match,
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
