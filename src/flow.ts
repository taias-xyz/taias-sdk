import type { FlowBuilder, FlowDefinition, FlowStep, StepHandler } from "./types";

/**
 * Define a flow with its steps.
 *
 * @param flowId - Unique identifier for the flow
 * @param builder - Callback that receives a FlowBuilder to define steps
 * @returns A FlowDefinition object
 *
 * @example
 * ```ts
 * const onboardRepoFlow = defineFlow("onboard_repo", (flow) => {
 *   flow.step("scan_repo", (ctx) => ({
 *     nextTool: "configure_app",
 *   }));
 * });
 * ```
 */
export function defineFlow(
  flowId: string,
  builder: (flow: FlowBuilder) => void
): FlowDefinition {
  const steps: FlowStep[] = [];

  const flowBuilder: FlowBuilder = {
    step(toolName: string, handler: StepHandler): void {
      steps.push({ toolName, handler });
    },
  };

  builder(flowBuilder);

  return {
    id: flowId,
    steps,
  };
}

