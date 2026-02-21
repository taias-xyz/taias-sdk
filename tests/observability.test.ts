import { describe, it, expect, vi } from "vitest";
import { defineFlow, createTaias, createDebugSubscriber } from "../src";
import type { ResolveEvent } from "../src";

describe("Observability", () => {
  describe("event emission", () => {
    it("emits a resolve event on every resolve call", async () => {
      const flow = defineFlow("obs_flow", (flow) => {
        flow.step({ toolName: { is: "scan_repo" } }, { nextTool: "configure_app" });
      });

      const taias = createTaias({ flow });
      const handler = vi.fn();
      taias.on("resolve", handler);

      await taias.resolve({ toolName: "scan_repo" });

      expect(handler).toHaveBeenCalledTimes(1);
      const event: ResolveEvent = handler.mock.calls[0][0];
      expect(event.flowId).toBe("obs_flow");
      expect(event.context).toEqual({ toolName: "scan_repo" });
      expect(event.decision).toBeTruthy();
      expect(event.decision?.nextTool).toBe("configure_app");
      expect(event.affordances).toBeTruthy();
      expect(event.timestamp).toBeGreaterThan(0);
      expect(event.durationMs).toBeGreaterThanOrEqual(0);
    });

    it("emits an event even when no step matches", async () => {
      const flow = defineFlow("obs_flow", (flow) => {
        flow.step({ toolName: { is: "scan_repo" } }, { nextTool: "configure_app" });
      });

      const taias = createTaias({ flow });
      const handler = vi.fn();
      taias.on("resolve", handler);

      await taias.resolve({ toolName: "unknown_tool" });

      expect(handler).toHaveBeenCalledTimes(1);
      const event: ResolveEvent = handler.mock.calls[0][0];
      expect(event.decision).toBeNull();
      expect(event.affordances).toBeNull();
      expect(event.trace.matched).toBe(false);
    });

    it("emits multiple events for multiple resolve calls", async () => {
      const flow = defineFlow("obs_flow", (flow) => {
        flow.step({ toolName: { is: "tool_a" } }, { nextTool: "tool_b" });
        flow.step({ toolName: { is: "tool_b" } }, { nextTool: "tool_c" });
      });

      const taias = createTaias({ flow });
      const handler = vi.fn();
      taias.on("resolve", handler);

      await taias.resolve({ toolName: "tool_a" });
      await taias.resolve({ toolName: "tool_b" });

      expect(handler).toHaveBeenCalledTimes(2);
      expect(handler.mock.calls[0][0].decision.nextTool).toBe("tool_b");
      expect(handler.mock.calls[1][0].decision.nextTool).toBe("tool_c");
    });
  });

  describe("subscription management", () => {
    it("unsubscribes a handler via off()", async () => {
      const flow = defineFlow("obs_flow", (flow) => {
        flow.step({ toolName: { is: "tool_a" } }, { nextTool: "tool_b" });
      });

      const taias = createTaias({ flow });
      const handler = vi.fn();
      taias.on("resolve", handler);

      await taias.resolve({ toolName: "tool_a" });
      expect(handler).toHaveBeenCalledTimes(1);

      taias.off("resolve", handler);

      await taias.resolve({ toolName: "tool_a" });
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it("supports multiple subscribers that all fire", async () => {
      const flow = defineFlow("obs_flow", (flow) => {
        flow.step({ toolName: { is: "tool_a" } }, { nextTool: "tool_b" });
      });

      const taias = createTaias({ flow });
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      taias.on("resolve", handler1);
      taias.on("resolve", handler2);

      await taias.resolve({ toolName: "tool_a" });

      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);

      const event1: ResolveEvent = handler1.mock.calls[0][0];
      const event2: ResolveEvent = handler2.mock.calls[0][0];
      expect(event1).toEqual(event2);
    });

    it("removing one subscriber does not affect others", async () => {
      const flow = defineFlow("obs_flow", (flow) => {
        flow.step({ toolName: { is: "tool_a" } }, { nextTool: "tool_b" });
      });

      const taias = createTaias({ flow });
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      taias.on("resolve", handler1);
      taias.on("resolve", handler2);

      taias.off("resolve", handler1);

      await taias.resolve({ toolName: "tool_a" });

      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).toHaveBeenCalledTimes(1);
    });

    it("does not error when removing a handler that was never added", () => {
      const flow = defineFlow("obs_flow", () => {});
      const taias = createTaias({ flow });
      expect(() => taias.off("resolve", () => {})).not.toThrow();
    });
  });

  describe("summary trace", () => {
    it("includes correct trace fields for a matched step (indexed phase)", async () => {
      const flow = defineFlow("obs_flow", (flow) => {
        flow.step({ toolName: { is: "scan_repo" } }, { nextTool: "configure_app" });
        flow.step({ toolName: { is: "deploy" } }, { nextTool: "monitor" });
      });

      const taias = createTaias({ flow });
      const handler = vi.fn();
      taias.on("resolve", handler);

      await taias.resolve({ toolName: "scan_repo" });

      const event: ResolveEvent = handler.mock.calls[0][0];
      expect(event.trace.matched).toBe(true);
      expect(event.trace.matchedStepIndex).toBe(0);
      expect(event.trace.matchedStepKind).toBe("logic");
      expect(event.trace.matchedStepMatch).toEqual({ toolName: { is: "scan_repo" } });
      expect(event.trace.phase).toBe("indexed");
      expect(event.trace.resolutionPath).toContain("toolName");
      expect(event.trace.candidatesEvaluated).toBeGreaterThanOrEqual(1);
      expect(event.trace.evaluations).toBeUndefined();
    });

    it("includes correct trace for a broad-phase match (isNot)", async () => {
      const flow = defineFlow("obs_flow", (flow) => {
        flow.step({ toolName: { isNot: "abort" } }, { nextTool: "continue" });
      });

      const taias = createTaias({ flow });
      const handler = vi.fn();
      taias.on("resolve", handler);

      await taias.resolve({ toolName: "any_tool" });

      const event: ResolveEvent = handler.mock.calls[0][0];
      expect(event.trace.matched).toBe(true);
      expect(event.trace.matchedStepIndex).toBe(0);
      expect(event.trace.phase).toBe("broad");
    });

    it("records no-match trace correctly", async () => {
      const flow = defineFlow("obs_flow", (flow) => {
        flow.step({ toolName: { is: "scan_repo" } }, { nextTool: "configure_app" });
      });

      const taias = createTaias({ flow });
      const handler = vi.fn();
      taias.on("resolve", handler);

      await taias.resolve({ toolName: "nonexistent" });

      const event: ResolveEvent = handler.mock.calls[0][0];
      expect(event.trace.matched).toBe(false);
      expect(event.trace.matchedStepIndex).toBeNull();
      expect(event.trace.matchedStepKind).toBeNull();
      expect(event.trace.matchedStepMatch).toBeNull();
      expect(event.trace.phase).toBeNull();
    });

    it("records resolution path with multiple field indexes", async () => {
      const flow = defineFlow("obs_flow", (flow) => {
        flow.step(
          {
            toolName: { is: "analyze" },
            params: { language: { is: "typescript" } },
          },
          { nextTool: "ts_lint" }
        );
      });

      const taias = createTaias({ flow });
      const handler = vi.fn();
      taias.on("resolve", handler);

      await taias.resolve({
        toolName: "analyze",
        params: { language: "typescript" },
      });

      const event: ResolveEvent = handler.mock.calls[0][0];
      expect(event.trace.matched).toBe(true);
      expect(event.trace.resolutionPath).toContain("toolName");
      expect(event.trace.resolutionPath).toContain("params.language");
    });

    it("reports handler step kind for handler-based steps", async () => {
      const flow = defineFlow("obs_flow", (flow) => {
        flow.step({ toolName: { is: "scan_repo" } }, () => ({
          nextTool: "configure_app",
        }));
      });

      const taias = createTaias({ flow });
      const handler = vi.fn();
      taias.on("resolve", handler);

      await taias.resolve({ toolName: "scan_repo" });

      const event: ResolveEvent = handler.mock.calls[0][0];
      expect(event.trace.matchedStepKind).toBe("handler");
    });
  });

  describe("detailed tracing", () => {
    it("includes per-step evaluations when tracing is detailed", async () => {
      const flow = defineFlow("obs_flow", (flow) => {
        flow.step({ toolName: { is: "tool_a" } }, { nextTool: "tool_b" });
        flow.step({ toolName: { is: "tool_b" } }, { nextTool: "tool_c" });
      });

      const taias = createTaias({ flow, tracing: "detailed" });
      const handler = vi.fn();
      taias.on("resolve", handler);

      await taias.resolve({ toolName: "tool_b" });

      const event: ResolveEvent = handler.mock.calls[0][0];
      expect(event.trace.evaluations).toBeDefined();
      expect(event.trace.evaluations!.length).toBeGreaterThanOrEqual(1);

      const matchedEval = event.trace.evaluations!.find((e) => e.result === "matched");
      expect(matchedEval).toBeDefined();
      expect(matchedEval!.stepIndex).toBe(1);
      expect(matchedEval!.fieldResults).toBeDefined();
      expect(matchedEval!.fieldResults!["toolName"]).toEqual({
        condition: { is: "tool_b" },
        actual: "tool_b",
        passed: true,
      });
    });

    it("shows failed field results for non-matching steps", async () => {
      const flow = defineFlow("obs_flow", (flow) => {
        flow.step({ toolName: { is: "tool_a" } }, { nextTool: "tool_b" });
        flow.step({ toolName: { is: "tool_b" } }, { nextTool: "tool_c" });
      });

      const taias = createTaias({ flow, tracing: "detailed" });
      const handler = vi.fn();
      taias.on("resolve", handler);

      await taias.resolve({ toolName: "tool_b" });

      const event: ResolveEvent = handler.mock.calls[0][0];
      const failedEvals = event.trace.evaluations!.filter((e) => e.result === "no-match");

      for (const eval_ of failedEvals) {
        expect(eval_.fieldResults).toBeDefined();
        const toolNameResult = eval_.fieldResults!["toolName"];
        if (toolNameResult) {
          expect(toolNameResult.passed).toBe(false);
        }
      }
    });

    it("includes field results for params/result conditions", async () => {
      const flow = defineFlow("obs_flow", (flow) => {
        flow.step(
          {
            toolName: { is: "analyze" },
            params: { language: { is: "python" } },
          },
          { nextTool: "py_lint" }
        );
        flow.step(
          {
            toolName: { is: "analyze" },
            params: { language: { is: "typescript" } },
          },
          { nextTool: "ts_lint" }
        );
      });

      const taias = createTaias({ flow, tracing: "detailed" });
      const handler = vi.fn();
      taias.on("resolve", handler);

      await taias.resolve({
        toolName: "analyze",
        params: { language: "typescript" },
      });

      const event: ResolveEvent = handler.mock.calls[0][0];
      expect(event.trace.evaluations).toBeDefined();

      const matched = event.trace.evaluations!.find((e) => e.result === "matched");
      expect(matched).toBeDefined();
      expect(matched!.fieldResults!["params.language"]).toEqual({
        condition: { is: "typescript" },
        actual: "typescript",
        passed: true,
      });
    });

    it("evaluations not present in summary mode", async () => {
      const flow = defineFlow("obs_flow", (flow) => {
        flow.step({ toolName: { is: "tool_a" } }, { nextTool: "tool_b" });
      });

      const taias = createTaias({ flow, tracing: "summary" });
      const handler = vi.fn();
      taias.on("resolve", handler);

      await taias.resolve({ toolName: "tool_a" });

      const event: ResolveEvent = handler.mock.calls[0][0];
      expect(event.trace.evaluations).toBeUndefined();
    });

    it("defaults to summary tracing when no option provided", async () => {
      const flow = defineFlow("obs_flow", (flow) => {
        flow.step({ toolName: { is: "tool_a" } }, { nextTool: "tool_b" });
      });

      const taias = createTaias({ flow });
      const handler = vi.fn();
      taias.on("resolve", handler);

      await taias.resolve({ toolName: "tool_a" });

      const event: ResolveEvent = handler.mock.calls[0][0];
      expect(event.trace.evaluations).toBeUndefined();
    });
  });

  describe("debug subscriber", () => {
    it("default format logs multi-line output for a match", async () => {
      const flow = defineFlow("obs_flow", (flow) => {
        flow.step({ toolName: { is: "scan_repo" } }, { nextTool: "configure_app" });
      });

      const taias = createTaias({ flow });
      const logger = vi.fn();
      const subscriber = createDebugSubscriber({ logger });
      taias.on("resolve", subscriber);

      await taias.resolve({ toolName: "scan_repo" });

      expect(logger).toHaveBeenCalledTimes(1);
      const output: string = logger.mock.calls[0][0];
      expect(output).toContain("Taias Resolve");
      expect(output).toContain("obs_flow");
      expect(output).toContain("scan_repo");
      expect(output).toContain("Matched: step 0");
      expect(output).toContain("nextTool=configure_app");
    });

    it("default format labels no-match clearly", async () => {
      const flow = defineFlow("obs_flow", (flow) => {
        flow.step({ toolName: { is: "scan_repo" } }, { nextTool: "configure_app" });
      });

      const taias = createTaias({ flow });
      const logger = vi.fn();
      const subscriber = createDebugSubscriber({ logger });
      taias.on("resolve", subscriber);

      await taias.resolve({ toolName: "unknown" });

      const output: string = logger.mock.calls[0][0];
      expect(output).toContain("NO MATCH");
    });

    it("compact format logs a single line for a match", async () => {
      const flow = defineFlow("obs_flow", (flow) => {
        flow.step({ toolName: { is: "scan_repo" } }, { nextTool: "configure_app" });
      });

      const taias = createTaias({ flow });
      const logger = vi.fn();
      const subscriber = createDebugSubscriber({ format: "compact", logger });
      taias.on("resolve", subscriber);

      await taias.resolve({ toolName: "scan_repo" });

      expect(logger).toHaveBeenCalledTimes(1);
      const output: string = logger.mock.calls[0][0];
      expect(output).toContain("[Taias]");
      expect(output).toContain("scan_repo");
      expect(output).toContain("nextTool=configure_app");
      expect(output).not.toContain("\n");
    });

    it("compact format logs no match", async () => {
      const flow = defineFlow("obs_flow", (flow) => {
        flow.step({ toolName: { is: "scan_repo" } }, { nextTool: "configure_app" });
      });

      const taias = createTaias({ flow });
      const logger = vi.fn();
      const subscriber = createDebugSubscriber({ format: "compact", logger });
      taias.on("resolve", subscriber);

      await taias.resolve({ toolName: "unknown" });

      const output: string = logger.mock.calls[0][0];
      expect(output).toContain("[Taias]");
      expect(output).toContain("no match");
    });

    it("default format includes detailed evaluations when present", async () => {
      const flow = defineFlow("obs_flow", (flow) => {
        flow.step({ toolName: { is: "tool_a" } }, { nextTool: "tool_b" });
        flow.step({ toolName: { is: "tool_b" } }, { nextTool: "tool_c" });
      });

      const taias = createTaias({ flow, tracing: "detailed" });
      const logger = vi.fn();
      const subscriber = createDebugSubscriber({ logger });
      taias.on("resolve", subscriber);

      await taias.resolve({ toolName: "tool_b" });

      const output: string = logger.mock.calls[0][0];
      expect(output).toContain("Detailed evaluations");
    });
  });

  describe("event schema completeness", () => {
    it("event has all required top-level fields", async () => {
      const flow = defineFlow("obs_flow", (flow) => {
        flow.step({ toolName: { is: "tool_a" } }, { nextTool: "tool_b" });
      });

      const taias = createTaias({ flow });
      const handler = vi.fn();
      taias.on("resolve", handler);

      await taias.resolve({ toolName: "tool_a" });

      const event: ResolveEvent = handler.mock.calls[0][0];
      expect(event).toHaveProperty("flowId");
      expect(event).toHaveProperty("timestamp");
      expect(event).toHaveProperty("durationMs");
      expect(event).toHaveProperty("context");
      expect(event).toHaveProperty("trace");
      expect(event).toHaveProperty("decision");
      expect(event).toHaveProperty("affordances");
    });

    it("affordances include advice and selections", async () => {
      const flow = defineFlow("obs_flow", (flow) => {
        flow.step({ toolName: { is: "tool_a" } }, { nextTool: "tool_b" });
      });

      const taias = createTaias({ flow });
      const handler = vi.fn();
      taias.on("resolve", handler);

      await taias.resolve({ toolName: "tool_a" });

      const event: ResolveEvent = handler.mock.calls[0][0];
      expect(event.affordances).toBeTruthy();
      expect(event.affordances!.advice).toBeTruthy();
      expect(event.affordances).toHaveProperty("selections");
    });

    it("handler returning null produces event with decision null", async () => {
      const flow = defineFlow("obs_flow", (flow) => {
        flow.step({ toolName: { is: "tool_a" } }, () => null);
      });

      const taias = createTaias({ flow });
      const handler = vi.fn();
      taias.on("resolve", handler);

      await taias.resolve({ toolName: "tool_a" });

      const event: ResolveEvent = handler.mock.calls[0][0];
      expect(event.trace.matched).toBe(true);
      expect(event.trace.matchedStepIndex).toBe(0);
      expect(event.decision).toBeNull();
      expect(event.affordances).toBeNull();
    });
  });

  describe("debug option", () => {
    it("debug: true auto-wires the debug subscriber", async () => {
      const flow = defineFlow("obs_flow", (flow) => {
        flow.step({ toolName: { is: "scan_repo" } }, { nextTool: "configure_app" });
      });

      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const taias = createTaias({ flow, debug: true });
      await taias.resolve({ toolName: "scan_repo" });

      expect(logSpy).toHaveBeenCalledTimes(1);
      const output: string = logSpy.mock.calls[0][0];
      expect(output).toContain("Taias Resolve");
      expect(output).toContain("scan_repo");
      expect(output).toContain("nextTool=configure_app");

      logSpy.mockRestore();
    });

    it("debug: false (default) produces no output", async () => {
      const flow = defineFlow("obs_flow", (flow) => {
        flow.step({ toolName: { is: "scan_repo" } }, { nextTool: "configure_app" });
      });

      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const taias = createTaias({ flow });
      await taias.resolve({ toolName: "scan_repo" });

      expect(logSpy).not.toHaveBeenCalled();

      logSpy.mockRestore();
    });

    it("debug: { format: 'compact' } produces compact output", async () => {
      const flow = defineFlow("obs_flow", (flow) => {
        flow.step({ toolName: { is: "scan_repo" } }, { nextTool: "configure_app" });
      });

      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const taias = createTaias({ flow, debug: { format: "compact" } });
      await taias.resolve({ toolName: "scan_repo" });

      expect(logSpy).toHaveBeenCalledTimes(1);
      const output: string = logSpy.mock.calls[0][0];
      expect(output).toContain("[Taias]");
      expect(output).toContain("scan_repo");
      expect(output).not.toContain("\n");

      logSpy.mockRestore();
    });

    it("debug: { logger: fn } routes output to custom logger", async () => {
      const flow = defineFlow("obs_flow", (flow) => {
        flow.step({ toolName: { is: "scan_repo" } }, { nextTool: "configure_app" });
      });

      const logger = vi.fn();
      const taias = createTaias({ flow, debug: { logger } });
      await taias.resolve({ toolName: "scan_repo" });

      expect(logger).toHaveBeenCalledTimes(1);
      const output: string = logger.mock.calls[0][0];
      expect(output).toContain("Taias Resolve");
    });

    it("debug: true with tracing: 'detailed' shows evaluations", async () => {
      const flow = defineFlow("obs_flow", (flow) => {
        flow.step({ toolName: { is: "tool_a" } }, { nextTool: "tool_b" });
        flow.step({ toolName: { is: "tool_b" } }, { nextTool: "tool_c" });
      });

      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const taias = createTaias({ flow, debug: true, tracing: "detailed" });
      await taias.resolve({ toolName: "tool_b" });

      expect(logSpy).toHaveBeenCalledTimes(1);
      const output: string = logSpy.mock.calls[0][0];
      expect(output).toContain("Detailed evaluations");

      logSpy.mockRestore();
    });

    it("debug: true coexists with manual on() subscribers", async () => {
      const flow = defineFlow("obs_flow", (flow) => {
        flow.step({ toolName: { is: "scan_repo" } }, { nextTool: "configure_app" });
      });

      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const manualHandler = vi.fn();

      const taias = createTaias({ flow, debug: true });
      taias.on("resolve", manualHandler);

      await taias.resolve({ toolName: "scan_repo" });

      expect(logSpy).toHaveBeenCalledTimes(1);
      expect(manualHandler).toHaveBeenCalledTimes(1);

      logSpy.mockRestore();
    });
  });

  describe("toolName-optional context display", () => {
    it("default format displays context without toolName", async () => {
      const flow = defineFlow("obs_flow", (flow) => {
        flow.step(
          { params: { language: { is: "python" } } },
          { nextTool: "python_handler" },
        );
      });

      const logger = vi.fn();
      const taias = createTaias({ flow, debug: { logger } });
      await taias.resolve({ toolName: "any", params: { language: "python" } });

      const output: string = logger.mock.calls[0][0];
      expect(output).toContain("params");
      expect(output).toContain("python");
    });

    it("compact format uses toolName when present", async () => {
      const flow = defineFlow("obs_flow", (flow) => {
        flow.step({ toolName: { is: "scan_repo" } }, { nextTool: "configure_app" });
      });

      const logger = vi.fn();
      const taias = createTaias({ flow, debug: { format: "compact", logger } });
      await taias.resolve({ toolName: "scan_repo" });

      const output: string = logger.mock.calls[0][0];
      expect(output).toContain("[Taias] scan_repo");
    });

    it("compact format falls back to params when toolName absent", async () => {
      const flow = defineFlow("obs_flow", (flow) => {
        flow.step(
          { params: { language: { is: "python" } } },
          { nextTool: "python_handler" },
        );
      });

      const logger = vi.fn();
      const taias = createTaias({ flow, debug: { format: "compact", logger } });
      await taias.resolve({ toolName: "", params: { language: "python" } });

      const output: string = logger.mock.calls[0][0];
      expect(output).toContain("[Taias] params:");
      expect(output).toContain("python");
    });

    it("default format shows all present context fields", async () => {
      const flow = defineFlow("obs_flow", (flow) => {
        flow.step(
          {
            toolName: { is: "analyze" },
            params: { language: { is: "typescript" } },
            result: { hasConfig: { is: true } },
          },
          { nextTool: "review" },
        );
      });

      const logger = vi.fn();
      const taias = createTaias({ flow, debug: { logger } });
      await taias.resolve({
        toolName: "analyze",
        params: { language: "typescript" },
        result: { hasConfig: true },
      });

      const output: string = logger.mock.calls[0][0];
      expect(output).toContain("toolName=analyze");
      expect(output).toContain("params=");
      expect(output).toContain("result=");
    });
  });
});
