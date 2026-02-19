import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { defineFlow, createTaias } from "../src";
import type { TaiasContext, FlowStep } from "../src";

describe("Taias", () => {
  describe("defineFlow", () => {
    it("creates a flow definition with id and steps (handler form)", () => {
      const flow = defineFlow("test_flow", (flow) => {
        flow.step("tool_a", () => ({ nextTool: "tool_b" }));
        flow.step("tool_b", () => ({ nextTool: "tool_c" }));
      });

      expect(flow.id).toBe("test_flow");
      expect(flow.steps).toHaveLength(2);

      // Handler-based steps have kind "handler" and match condition
      const step0 = flow.steps[0];
      const step1 = flow.steps[1];
      expect(step0.kind).toBe("handler");
      expect(step1.kind).toBe("handler");
      if (step0.kind === "handler") expect(step0.match.toolName).toBe("tool_a");
      if (step1.kind === "handler") expect(step1.match.toolName).toBe("tool_b");
    });

    it("creates an empty flow when no steps are defined", () => {
      const flow = defineFlow("empty_flow", () => {});

      expect(flow.id).toBe("empty_flow");
      expect(flow.steps).toHaveLength(0);
    });
  });

  describe("createTaias", () => {
    describe("resolve", () => {
      it("returns auto-generated advice when step matches", async () => {
        const flow = defineFlow("test_flow", (flow) => {
          flow.step("scan_repo", () => ({
            nextTool: "configure_app",
          }));
        });

        const taias = createTaias({ flow });
        const decision = await taias.resolve({ toolName: "scan_repo" });

        expect(decision).not.toBeNull();
        expect(decision?.advice).toBe(
          "FOR THE BEST USER EXPERIENCE, TELL THE USER TO USE THE configure_app TOOL NEXT!!!!!"
        );
      });

      it("returns null when no step matches", async () => {
        const flow = defineFlow("test_flow", (flow) => {
          flow.step("scan_repo", () => ({
            nextTool: "configure_app",
          }));
        });

        const taias = createTaias({ flow });
        const decision = await taias.resolve({ toolName: "unknown_tool" });

        expect(decision).toBeNull();
      });

      it("passes context to handler", async () => {
        const handlerSpy = vi.fn((ctx: TaiasContext) => ({
          nextTool: `next_${ctx.toolName}`,
        }));

        const flow = defineFlow("test_flow", (flow) => {
          flow.step("my_tool", handlerSpy);
        });

        const taias = createTaias({ flow });
        const decision = await taias.resolve({ toolName: "my_tool" });

        expect(handlerSpy).toHaveBeenCalledWith({ toolName: "my_tool" });
        expect(decision?.advice).toBe(
          "FOR THE BEST USER EXPERIENCE, TELL THE USER TO USE THE next_my_tool TOOL NEXT!!!!!"
        );
      });

      it("supports async handlers", async () => {
        const flow = defineFlow("test_flow", (flow) => {
          flow.step("async_tool", async () => {
            await new Promise((resolve) => setTimeout(resolve, 10));
            return { nextTool: "next_async_tool" };
          });
        });

        const taias = createTaias({ flow });
        const decision = await taias.resolve({ toolName: "async_tool" });

        expect(decision?.advice).toBe(
          "FOR THE BEST USER EXPERIENCE, TELL THE USER TO USE THE next_async_tool TOOL NEXT!!!!!"
        );
      });

      it("supports handlers returning null", async () => {
        const flow = defineFlow("test_flow", (flow) => {
          flow.step("nullable_tool", () => null);
        });

        const taias = createTaias({ flow });
        const decision = await taias.resolve({ toolName: "nullable_tool" });

        expect(decision).toBeNull();
      });
    });

    describe("params and result context", () => {
      it("passes params to handler via context", async () => {
        const handlerSpy = vi.fn((ctx: TaiasContext) => ({
          nextTool: ctx.params?.language === "python" ? "configure_python" : "configure_generic",
        }));

        const flow = defineFlow("test_flow", (flow) => {
          flow.step("scan_repo", handlerSpy);
        });

        const taias = createTaias({ flow });
        const decision = await taias.resolve({
          toolName: "scan_repo",
          params: { language: "python", repoUrl: "https://example.com" },
        });

        expect(handlerSpy).toHaveBeenCalledWith({
          toolName: "scan_repo",
          params: { language: "python", repoUrl: "https://example.com" },
        });
        expect(decision?.advice).toBe(
          "FOR THE BEST USER EXPERIENCE, TELL THE USER TO USE THE configure_python TOOL NEXT!!!!!"
        );
      });

      it("passes result to handler via context", async () => {
        const flow = defineFlow("test_flow", (flow) => {
          flow.step("scan_repo", (ctx) => ({
            nextTool: ctx.result?.hasConfig ? "review_config" : "create_config",
          }));
        });

        const taias = createTaias({ flow });
        const decision = await taias.resolve({
          toolName: "scan_repo",
          result: { hasConfig: true, fileCount: 42 },
        });

        expect(decision?.advice).toBe(
          "FOR THE BEST USER EXPERIENCE, TELL THE USER TO USE THE review_config TOOL NEXT!!!!!"
        );
      });

      it("handler uses both params and result for decisions", async () => {
        const flow = defineFlow("test_flow", (flow) => {
          flow.step("scan_repo", (ctx) => {
            if (ctx.params?.language === "python" && ctx.result?.hasConfig) {
              return { nextTool: "review_python_config" };
            }
            if (ctx.params?.language === "python") {
              return { nextTool: "create_python_config" };
            }
            return { nextTool: "configure_generic" };
          });
        });

        const taias = createTaias({ flow });

        const decision1 = await taias.resolve({
          toolName: "scan_repo",
          params: { language: "python" },
          result: { hasConfig: true },
        });
        expect(decision1?.advice).toBe(
          "FOR THE BEST USER EXPERIENCE, TELL THE USER TO USE THE review_python_config TOOL NEXT!!!!!"
        );

        const decision2 = await taias.resolve({
          toolName: "scan_repo",
          params: { language: "python" },
          result: { hasConfig: false },
        });
        expect(decision2?.advice).toBe(
          "FOR THE BEST USER EXPERIENCE, TELL THE USER TO USE THE create_python_config TOOL NEXT!!!!!"
        );

        const decision3 = await taias.resolve({
          toolName: "scan_repo",
          params: { language: "go" },
          result: { hasConfig: true },
        });
        expect(decision3?.advice).toBe(
          "FOR THE BEST USER EXPERIENCE, TELL THE USER TO USE THE configure_generic TOOL NEXT!!!!!"
        );
      });

      it("works without params or result (backward compat)", async () => {
        const flow = defineFlow("test_flow", (flow) => {
          flow.step("scan_repo", () => ({
            nextTool: "configure_app",
          }));
        });

        const taias = createTaias({ flow });
        const decision = await taias.resolve({ toolName: "scan_repo" });

        expect(decision).not.toBeNull();
        expect(decision?.advice).toBe(
          "FOR THE BEST USER EXPERIENCE, TELL THE USER TO USE THE configure_app TOOL NEXT!!!!!"
        );
      });

      it("params and result are undefined when not provided", async () => {
        const handlerSpy = vi.fn((ctx: TaiasContext) => ({
          nextTool: "next_tool",
        }));

        const flow = defineFlow("test_flow", (flow) => {
          flow.step("my_tool", handlerSpy);
        });

        const taias = createTaias({ flow });
        await taias.resolve({ toolName: "my_tool" });

        const ctx = handlerSpy.mock.calls[0][0];
        expect(ctx.params).toBeUndefined();
        expect(ctx.result).toBeUndefined();
      });

      it("includes params and result in the decision object's context", async () => {
        const flow = defineFlow("test_flow", (flow) => {
          flow.step("scan_repo", (ctx) => ({
            nextTool: "configure_app",
            variant: String(ctx.params?.language ?? "unknown"),
          }));
        });

        const taias = createTaias({ flow });
        const affordances = await taias.resolve({
          toolName: "scan_repo",
          params: { language: "python" },
        });

        expect(affordances?.decision).toEqual({
          nextTool: "configure_app",
          variant: "python",
        });
      });
    });

    describe("onMissingStep callback", () => {
      it("invokes onMissingStep when no step matches", async () => {
        const onMissingStep = vi.fn();

        const flow = defineFlow("test_flow", (flow) => {
          flow.step("existing_tool", () => ({ nextTool: "next_tool" }));
        });

        const taias = createTaias({ flow, onMissingStep });
        await taias.resolve({ toolName: "missing_tool" });

        expect(onMissingStep).toHaveBeenCalledWith({ toolName: "missing_tool" });
      });

      it("does not invoke onMissingStep when step exists", async () => {
        const onMissingStep = vi.fn();

        const flow = defineFlow("test_flow", (flow) => {
          flow.step("existing_tool", () => ({ nextTool: "next_tool" }));
        });

        const taias = createTaias({ flow, onMissingStep });
        await taias.resolve({ toolName: "existing_tool" });

        expect(onMissingStep).not.toHaveBeenCalled();
      });
    });

    describe("devMode", () => {
      it("throws on duplicate match condition in devMode", () => {
        const flow = defineFlow("test_flow", (flow) => {
          flow.step("scan_repo", () => ({ nextTool: "first" }));
          flow.step("scan_repo", () => ({ nextTool: "second" }));
        });

        expect(() => createTaias({ flow, devMode: true })).toThrow(
          "Taias: Duplicate match condition 'scan_repo' in flow 'test_flow'. Each step must have a unique match condition."
        );
      });

      it("does not throw on duplicate match condition when devMode is false", () => {
        const flow = defineFlow("test_flow", (flow) => {
          flow.step("scan_repo", () => ({ nextTool: "first" }));
          flow.step("scan_repo", () => ({ nextTool: "second" }));
        });

        expect(() => createTaias({ flow, devMode: false })).not.toThrow();
      });

      it("does not throw on duplicate match condition when devMode is not specified", () => {
        const flow = defineFlow("test_flow", (flow) => {
          flow.step("scan_repo", () => ({ nextTool: "first" }));
          flow.step("scan_repo", () => ({ nextTool: "second" }));
        });

        expect(() => createTaias({ flow })).not.toThrow();
      });

      describe("empty nextTool warning", () => {
        let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

        beforeEach(() => {
          consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
        });

        afterEach(() => {
          consoleWarnSpy.mockRestore();
        });

        it("warns on empty nextTool in devMode", async () => {
          const flow = defineFlow("test_flow", (flow) => {
            flow.step("empty_next_tool", () => ({ nextTool: "" }));
          });

          const taias = createTaias({ flow, devMode: true });
          await taias.resolve({ toolName: "empty_next_tool" });

          expect(consoleWarnSpy).toHaveBeenCalledWith(
            "Taias: nextTool for tool 'empty_next_tool' is empty."
          );
        });

        it("does not warn on empty nextTool when devMode is false", async () => {
          const flow = defineFlow("test_flow", (flow) => {
            flow.step("empty_next_tool", () => ({ nextTool: "" }));
          });

          const taias = createTaias({ flow, devMode: false });
          await taias.resolve({ toolName: "empty_next_tool" });

          expect(consoleWarnSpy).not.toHaveBeenCalled();
        });

        it("does not warn about empty nextTool when nextTool is non-empty", async () => {
          const flow = defineFlow("test_flow", (flow) => {
            flow.step("valid_tool", () => ({ nextTool: "next_tool" }));
          });

          const taias = createTaias({ flow, devMode: true });
          await taias.resolve({ toolName: "valid_tool" });

          // Should not have the "empty nextTool" warning
          // (may have other devMode warnings like missing affordances, which is fine)
          const emptyNextToolWarning = consoleWarnSpy.mock.calls.find(
            (call) => (call[0] as string)?.includes("is empty")
          );
          expect(emptyNextToolWarning).toBeUndefined();
        });
      });
    });
  });

  describe("logic statements", () => {
    describe("defineFlow with static decisions", () => {
      it("creates logic-based FlowSteps when given a plain object", () => {
        const flow = defineFlow("test_flow", (flow) => {
          flow.step("scan_repo", { nextTool: "configure_app" });
        });

        expect(flow.steps).toHaveLength(1);
        const step = flow.steps[0];
        expect(step.kind).toBe("logic");
        if (step.kind === "logic") {
          expect(step.statement.match.toolName).toBe("scan_repo");
          expect(step.statement.decision).toEqual({ nextTool: "configure_app" });
        }
      });

      it("creates logic-based FlowSteps with custom decision fields", () => {
        const flow = defineFlow("test_flow", (flow) => {
          flow.step("scan_repo", { nextTool: "configure_app", variant: "python" });
        });

        const step = flow.steps[0];
        expect(step.kind).toBe("logic");
        if (step.kind === "logic") {
          expect(step.statement.decision).toEqual({
            nextTool: "configure_app",
            variant: "python",
          });
        }
      });

      it("creates handler-based FlowSteps when given a function", () => {
        const flow = defineFlow("test_flow", (flow) => {
          flow.step("scan_repo", () => ({ nextTool: "configure_app" }));
        });

        const step = flow.steps[0];
        expect(step.kind).toBe("handler");
        if (step.kind === "handler") {
          expect(step.match.toolName).toBe("scan_repo");
          expect(typeof step.handler).toBe("function");
        }
      });

      it("supports mixing logic and handler steps in the same flow", () => {
        const flow = defineFlow("test_flow", (flow) => {
          flow.step("tool_a", { nextTool: "tool_b" });
          flow.step("tool_b", () => ({ nextTool: "tool_c" }));
          flow.step("tool_c", { nextTool: "tool_d" });
        });

        expect(flow.steps).toHaveLength(3);
        expect(flow.steps[0].kind).toBe("logic");
        expect(flow.steps[1].kind).toBe("handler");
        expect(flow.steps[2].kind).toBe("logic");
      });
    });

    describe("resolve with logic statements", () => {
      it("returns correct advice from a static logic statement", async () => {
        const flow = defineFlow("test_flow", (flow) => {
          flow.step("scan_repo", { nextTool: "configure_app" });
        });

        const taias = createTaias({ flow });
        const result = await taias.resolve({ toolName: "scan_repo" });

        expect(result).not.toBeNull();
        expect(result?.advice).toBe(
          "FOR THE BEST USER EXPERIENCE, TELL THE USER TO USE THE configure_app TOOL NEXT!!!!!"
        );
      });

      it("returns correct decision object from a logic statement", async () => {
        const flow = defineFlow("test_flow", (flow) => {
          flow.step("scan_repo", { nextTool: "configure_app", variant: "python" });
        });

        const taias = createTaias({ flow });
        const result = await taias.resolve({ toolName: "scan_repo" });

        expect(result?.decision).toEqual({
          nextTool: "configure_app",
          variant: "python",
        });
      });

      it("returns null when no step matches a logic statement flow", async () => {
        const flow = defineFlow("test_flow", (flow) => {
          flow.step("scan_repo", { nextTool: "configure_app" });
        });

        const taias = createTaias({ flow });
        const result = await taias.resolve({ toolName: "unknown_tool" });

        expect(result).toBeNull();
      });

      it("resolves mixed flows correctly", async () => {
        const flow = defineFlow("test_flow", (flow) => {
          flow.step("tool_a", { nextTool: "tool_b" });
          flow.step("tool_b", () => ({ nextTool: "tool_c" }));
        });

        const taias = createTaias({ flow });

        const resultA = await taias.resolve({ toolName: "tool_a" });
        expect(resultA?.advice).toBe(
          "FOR THE BEST USER EXPERIENCE, TELL THE USER TO USE THE tool_b TOOL NEXT!!!!!"
        );

        const resultB = await taias.resolve({ toolName: "tool_b" });
        expect(resultB?.advice).toBe(
          "FOR THE BEST USER EXPERIENCE, TELL THE USER TO USE THE tool_c TOOL NEXT!!!!!"
        );
      });

      it("logic statements produce identical output to equivalent handlers", async () => {
        const logicFlow = defineFlow("logic_flow", (flow) => {
          flow.step("scan_repo", { nextTool: "configure_app" });
        });

        const handlerFlow = defineFlow("handler_flow", (flow) => {
          flow.step("scan_repo", () => ({ nextTool: "configure_app" }));
        });

        const logicTaias = createTaias({ flow: logicFlow });
        const handlerTaias = createTaias({ flow: handlerFlow });

        const logicResult = await logicTaias.resolve({ toolName: "scan_repo" });
        const handlerResult = await handlerTaias.resolve({ toolName: "scan_repo" });

        expect(logicResult).toEqual(handlerResult);
      });
    });

    describe("devMode with logic statements", () => {
      it("throws on duplicate match condition across logic statements", () => {
        const flow = defineFlow("test_flow", (flow) => {
          flow.step("scan_repo", { nextTool: "first" });
          flow.step("scan_repo", { nextTool: "second" });
        });

        expect(() => createTaias({ flow, devMode: true })).toThrow(
          "Taias: Duplicate match condition 'scan_repo' in flow 'test_flow'. Each step must have a unique match condition."
        );
      });

      it("throws on duplicate match condition across logic and handler steps", () => {
        const flow = defineFlow("test_flow", (flow) => {
          flow.step("scan_repo", { nextTool: "first" });
          flow.step("scan_repo", () => ({ nextTool: "second" }));
        });

        expect(() => createTaias({ flow, devMode: true })).toThrow(
          "Taias: Duplicate match condition 'scan_repo' in flow 'test_flow'. Each step must have a unique match condition."
        );
      });

      it("warns on empty nextTool in logic statements", async () => {
        const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

        const flow = defineFlow("test_flow", (flow) => {
          flow.step("empty_tool", { nextTool: "" });
        });

        const taias = createTaias({ flow, devMode: true });
        await taias.resolve({ toolName: "empty_tool" });

        expect(consoleWarnSpy).toHaveBeenCalledWith(
          "Taias: nextTool for tool 'empty_tool' is empty."
        );

        consoleWarnSpy.mockRestore();
      });
    });

    describe("onMissingStep with logic statements", () => {
      it("invokes onMissingStep when no logic statement matches", async () => {
        const onMissingStep = vi.fn();

        const flow = defineFlow("test_flow", (flow) => {
          flow.step("existing_tool", { nextTool: "next_tool" });
        });

        const taias = createTaias({ flow, onMissingStep });
        await taias.resolve({ toolName: "missing_tool" });

        expect(onMissingStep).toHaveBeenCalledWith({ toolName: "missing_tool" });
      });
    });

    describe("MatchCondition object form", () => {
      it("accepts a MatchCondition object as the first argument", () => {
        const flow = defineFlow("test_flow", (flow) => {
          flow.step({ toolName: "scan_repo" }, { nextTool: "configure_app" });
        });

        expect(flow.steps).toHaveLength(1);
        const step = flow.steps[0];
        expect(step.kind).toBe("logic");
        if (step.kind === "logic") {
          expect(step.statement.match).toEqual({ toolName: "scan_repo" });
          expect(step.statement.decision).toEqual({ nextTool: "configure_app" });
        }
      });

      it("MatchCondition object form resolves correctly", async () => {
        const flow = defineFlow("test_flow", (flow) => {
          flow.step({ toolName: "scan_repo" }, { nextTool: "configure_app" });
        });

        const taias = createTaias({ flow });
        const result = await taias.resolve({ toolName: "scan_repo" });

        expect(result).not.toBeNull();
        expect(result?.advice).toBe(
          "FOR THE BEST USER EXPERIENCE, TELL THE USER TO USE THE configure_app TOOL NEXT!!!!!"
        );
      });

      it("MatchCondition object form works with handler functions", () => {
        const flow = defineFlow("test_flow", (flow) => {
          flow.step({ toolName: "scan_repo" }, () => ({ nextTool: "configure_app" }));
        });

        const step = flow.steps[0];
        expect(step.kind).toBe("handler");
        if (step.kind === "handler") {
          expect(step.match).toEqual({ toolName: "scan_repo" });
        }
      });

      it("string and MatchCondition forms produce identical results", async () => {
        const stringFlow = defineFlow("string_flow", (flow) => {
          flow.step("scan_repo", { nextTool: "configure_app" });
        });

        const objectFlow = defineFlow("object_flow", (flow) => {
          flow.step({ toolName: "scan_repo" }, { nextTool: "configure_app" });
        });

        const stringTaias = createTaias({ flow: stringFlow });
        const objectTaias = createTaias({ flow: objectFlow });

        const stringResult = await stringTaias.resolve({ toolName: "scan_repo" });
        const objectResult = await objectTaias.resolve({ toolName: "scan_repo" });

        expect(stringResult).toEqual(objectResult);
      });
    });
  });

  describe("operators", () => {
    describe("is operator", () => {
      it("explicit { is } form resolves correctly", async () => {
        const flow = defineFlow("test_flow", (flow) => {
          flow.step({ toolName: { is: "scan_repo" } }, { nextTool: "configure_app" });
        });

        const taias = createTaias({ flow });
        const result = await taias.resolve({ toolName: "scan_repo" });

        expect(result).not.toBeNull();
        expect(result?.advice).toBe(
          "FOR THE BEST USER EXPERIENCE, TELL THE USER TO USE THE configure_app TOOL NEXT!!!!!"
        );
      });

      it("explicit { is } form returns null for non-matching tool", async () => {
        const flow = defineFlow("test_flow", (flow) => {
          flow.step({ toolName: { is: "scan_repo" } }, { nextTool: "configure_app" });
        });

        const taias = createTaias({ flow });
        const result = await taias.resolve({ toolName: "other_tool" });

        expect(result).toBeNull();
      });

      it("explicit { is } form creates logic-based FlowStep", () => {
        const flow = defineFlow("test_flow", (flow) => {
          flow.step({ toolName: { is: "scan_repo" } }, { nextTool: "configure_app" });
        });

        const step = flow.steps[0];
        expect(step.kind).toBe("logic");
        if (step.kind === "logic") {
          expect(step.statement.match).toEqual({ toolName: { is: "scan_repo" } });
          expect(step.statement.decision).toEqual({ nextTool: "configure_app" });
        }
      });
    });

    describe("isNot operator", () => {
      it("matches any tool except the specified one", async () => {
        const flow = defineFlow("test_flow", (flow) => {
          flow.step({ toolName: { isNot: "abort_session" } }, { nextTool: "continue_flow" });
        });

        const taias = createTaias({ flow });

        const result1 = await taias.resolve({ toolName: "scan_repo" });
        expect(result1).not.toBeNull();
        expect(result1?.decision.nextTool).toBe("continue_flow");

        const result2 = await taias.resolve({ toolName: "create_user" });
        expect(result2).not.toBeNull();
        expect(result2?.decision.nextTool).toBe("continue_flow");
      });

      it("does not match the excluded tool", async () => {
        const flow = defineFlow("test_flow", (flow) => {
          flow.step({ toolName: { isNot: "abort_session" } }, { nextTool: "continue_flow" });
        });

        const taias = createTaias({ flow });
        const result = await taias.resolve({ toolName: "abort_session" });

        expect(result).toBeNull();
      });

      it("isNot works with handler functions", async () => {
        const flow = defineFlow("test_flow", (flow) => {
          flow.step({ toolName: { isNot: "abort_session" } }, (ctx) => ({
            nextTool: `next_${ctx.toolName}`,
          }));
        });

        const taias = createTaias({ flow });

        const result = await taias.resolve({ toolName: "scan_repo" });
        expect(result?.decision.nextTool).toBe("next_scan_repo");

        const excluded = await taias.resolve({ toolName: "abort_session" });
        expect(excluded).toBeNull();
      });
    });

    describe("sugar equivalence", () => {
      it("all three forms produce identical results", async () => {
        const stringFlow = defineFlow("string_flow", (flow) => {
          flow.step("scan_repo", { nextTool: "configure_app" });
        });

        const bareSugarFlow = defineFlow("bare_sugar_flow", (flow) => {
          flow.step({ toolName: "scan_repo" }, { nextTool: "configure_app" });
        });

        const explicitIsFlow = defineFlow("explicit_is_flow", (flow) => {
          flow.step({ toolName: { is: "scan_repo" } }, { nextTool: "configure_app" });
        });

        const stringTaias = createTaias({ flow: stringFlow });
        const bareSugarTaias = createTaias({ flow: bareSugarFlow });
        const explicitIsTaias = createTaias({ flow: explicitIsFlow });

        const stringResult = await stringTaias.resolve({ toolName: "scan_repo" });
        const bareSugarResult = await bareSugarTaias.resolve({ toolName: "scan_repo" });
        const explicitIsResult = await explicitIsTaias.resolve({ toolName: "scan_repo" });

        expect(stringResult).toEqual(bareSugarResult);
        expect(bareSugarResult).toEqual(explicitIsResult);
      });
    });

    describe("definition order", () => {
      it("when both is and isNot steps match, definition order applies (is first)", async () => {
        const flow = defineFlow("test_flow", (flow) => {
          flow.step({ toolName: { is: "scan_repo" } }, { nextTool: "specific_next" });
          flow.step({ toolName: { isNot: "abort_session" } }, { nextTool: "broad_next" });
        });

        const taias = createTaias({ flow });

        const result = await taias.resolve({ toolName: "scan_repo" });
        expect(result?.decision.nextTool).toBe("specific_next");
      });

      it("when both is and isNot steps match, definition order applies (isNot first)", async () => {
        const flow = defineFlow("test_flow", (flow) => {
          flow.step({ toolName: { isNot: "abort_session" } }, { nextTool: "broad_next" });
          flow.step({ toolName: { is: "scan_repo" } }, { nextTool: "specific_next" });
        });

        const taias = createTaias({ flow });

        const result = await taias.resolve({ toolName: "scan_repo" });
        expect(result?.decision.nextTool).toBe("broad_next");
      });

      it("isNot step catches tools not matched by is steps", async () => {
        const flow = defineFlow("test_flow", (flow) => {
          flow.step({ toolName: { is: "scan_repo" } }, { nextTool: "configure_app" });
          flow.step({ toolName: { isNot: "abort_session" } }, { nextTool: "continue_flow" });
        });

        const taias = createTaias({ flow });

        const specific = await taias.resolve({ toolName: "scan_repo" });
        expect(specific?.decision.nextTool).toBe("configure_app");

        const broad = await taias.resolve({ toolName: "create_user" });
        expect(broad?.decision.nextTool).toBe("continue_flow");

        const excluded = await taias.resolve({ toolName: "abort_session" });
        expect(excluded).toBeNull();
      });
    });

    describe("devMode with operators", () => {
      it("throws on duplicate { is } conditions", () => {
        const flow = defineFlow("test_flow", (flow) => {
          flow.step({ toolName: { is: "scan_repo" } }, { nextTool: "first" });
          flow.step({ toolName: { is: "scan_repo" } }, { nextTool: "second" });
        });

        expect(() => createTaias({ flow, devMode: true })).toThrow(
          "Taias: Duplicate match condition 'scan_repo' in flow 'test_flow'. Each step must have a unique match condition."
        );
      });

      it("throws on duplicate { isNot } conditions", () => {
        const flow = defineFlow("test_flow", (flow) => {
          flow.step({ toolName: { isNot: "abort" } }, { nextTool: "first" });
          flow.step({ toolName: { isNot: "abort" } }, { nextTool: "second" });
        });

        expect(() => createTaias({ flow, devMode: true })).toThrow(
          "Taias: Duplicate match condition 'isNot:abort' in flow 'test_flow'. Each step must have a unique match condition."
        );
      });

      it("does not throw when { is } and { isNot } have same value (different operators)", () => {
        const flow = defineFlow("test_flow", (flow) => {
          flow.step({ toolName: { is: "scan_repo" } }, { nextTool: "first" });
          flow.step({ toolName: { isNot: "scan_repo" } }, { nextTool: "second" });
        });

        expect(() => createTaias({ flow, devMode: true })).not.toThrow();
      });

      it("treats bare string and { is } as duplicates", () => {
        const flow = defineFlow("test_flow", (flow) => {
          flow.step({ toolName: "scan_repo" }, { nextTool: "first" });
          flow.step({ toolName: { is: "scan_repo" } }, { nextTool: "second" });
        });

        expect(() => createTaias({ flow, devMode: true })).toThrow(
          "Taias: Duplicate match condition"
        );
      });

      it("treats full string shorthand and { is } as duplicates", () => {
        const flow = defineFlow("test_flow", (flow) => {
          flow.step("scan_repo", { nextTool: "first" });
          flow.step({ toolName: { is: "scan_repo" } }, { nextTool: "second" });
        });

        expect(() => createTaias({ flow, devMode: true })).toThrow(
          "Taias: Duplicate match condition"
        );
      });
    });
  });

  describe("integration", () => {
    it("works with the documented example (handler form)", async () => {
      const flow = defineFlow("onboard_repo", (flow) => {
        flow.step("scan_repo", () => ({
          nextTool: "configure_app",
        }));
      });

      const taias = createTaias({ flow });

      const decision = await taias.resolve({ toolName: "scan_repo" });
      expect(decision?.advice).toBe(
        "FOR THE BEST USER EXPERIENCE, TELL THE USER TO USE THE configure_app TOOL NEXT!!!!!"
      );

      const nullDecision = await taias.resolve({ toolName: "unknown_tool" });
      expect(nullDecision).toBeNull();
    });

    it("works with the documented example (logic statement form)", async () => {
      const flow = defineFlow("onboard_repo", (flow) => {
        flow.step("scan_repo", { nextTool: "configure_app" });
      });

      const taias = createTaias({ flow });

      const decision = await taias.resolve({ toolName: "scan_repo" });
      expect(decision?.advice).toBe(
        "FOR THE BEST USER EXPERIENCE, TELL THE USER TO USE THE configure_app TOOL NEXT!!!!!"
      );

      const nullDecision = await taias.resolve({ toolName: "unknown_tool" });
      expect(nullDecision).toBeNull();
    });
  });
});
