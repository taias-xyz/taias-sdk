import type { ResolveEvent, TaiasContext, DebugOptions } from "./types";

export type DebugSubscriberOptions = DebugOptions;

function formatContext(context: TaiasContext): string {
  const parts: string[] = [];
  if (context.toolName) parts.push(`toolName=${context.toolName}`);
  if (context.params) parts.push(`params=${JSON.stringify(context.params)}`);
  if (context.result) parts.push(`result=${JSON.stringify(context.result)}`);
  return parts.length > 0 ? parts.join(", ") : "(empty)";
}

function formatContextLabel(context: TaiasContext): string {
  if (context.toolName) return context.toolName;
  if (context.params) return `params:${JSON.stringify(context.params)}`;
  if (context.result) return `result:${JSON.stringify(context.result)}`;
  return "(empty)";
}

/**
 * Create a debug subscriber for Taias resolve events.
 *
 * Returns a handler function suitable for `taias.on("resolve", handler)`.
 *
 * - "default" format: multi-line breakdown of context, trace, decision, and affordances.
 * - "compact" format: single line per resolve call.
 */
export function createDebugSubscriber(
  options?: DebugSubscriberOptions
): (event: ResolveEvent) => void {
  const format = options?.format ?? "default";
  const log = options?.logger ?? console.log;

  if (format === "compact") {
    return (event: ResolveEvent) => {
      const { trace, context } = event;
      const label = formatContextLabel(context);

      if (!trace.matched) {
        log(`[Taias] ${label} → no match (${trace.candidatesEvaluated} evaluated)`);
        return;
      }

      const decisionSummary = event.decision
        ? Object.entries(event.decision).map(([k, v]) => `${k}=${v}`).join(", ")
        : "null";

      log(
        `[Taias] ${label} → ${decisionSummary} (${trace.phase}, step ${trace.matchedStepIndex}, ${trace.candidatesEvaluated} evaluated)`
      );
    };
  }

  return (event: ResolveEvent) => {
    const { trace, context } = event;
    const lines: string[] = [];

    lines.push("┌─ Taias Resolve ─────────────────────────────");
    lines.push(`│ Flow: ${event.flowId}`);
    lines.push(`│ Context: ${formatContext(context)}`);

    lines.push("│");

    if (!trace.matched) {
      lines.push("│ Result: NO MATCH");
      lines.push(`│ Candidates evaluated: ${trace.candidatesEvaluated}`);
    } else {
      lines.push(`│ Matched: step ${trace.matchedStepIndex} (${trace.matchedStepKind})`);
      lines.push(`│ Phase: ${trace.phase}`);

      if (trace.resolutionPath.length > 0) {
        lines.push(`│ Resolution path: ${trace.resolutionPath.join(" → ")}`);
      }

      lines.push(`│ Candidates evaluated: ${trace.candidatesEvaluated}`);

      if (trace.matchedStepMatch) {
        lines.push(`│ Match condition: ${JSON.stringify(trace.matchedStepMatch)}`);
      }
    }

    lines.push("│");

    if (event.decision) {
      const fields = Object.entries(event.decision).map(([k, v]) => `${k}=${v}`).join(", ");
      lines.push(`│ Decision: ${fields}`);
    } else {
      lines.push("│ Decision: null");
    }

    if (event.affordances) {
      lines.push(`│ Advice: ${event.affordances.advice.slice(0, 80)}${event.affordances.advice.length > 80 ? "..." : ""}`);
    }

    lines.push(`│ Duration: ${event.durationMs.toFixed(2)}ms`);

    if (trace.evaluations) {
      lines.push("│");
      lines.push("│ Detailed evaluations:");
      for (const evaluation of trace.evaluations) {
        const icon = evaluation.result === "matched" ? "✓" : "✗";
        lines.push(`│   ${icon} step ${evaluation.stepIndex}: ${evaluation.result}`);

        if (evaluation.fieldResults) {
          for (const [field, fr] of Object.entries(evaluation.fieldResults)) {
            const fieldIcon = fr.passed ? "✓" : "✗";
            lines.push(`│     ${fieldIcon} ${field}: ${JSON.stringify(fr.condition)} vs ${JSON.stringify(fr.actual)}`);
          }
        }
      }
    }

    lines.push("└──────────────────────────────────────────────");

    log(lines.join("\n"));
  };
}
