import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { defineFlow, createTaias } from "../src";
import type { TaiasContext } from "../src";

describe("Taias", () => {
  describe("defineFlow", () => {
    it("creates a flow definition with id and steps", () => {
      const flow = defineFlow("test_flow", (flow) => {
        flow.step("tool_a", () => ({ nextTool: "tool_b" }));
        flow.step("tool_b", () => ({ nextTool: "tool_c" }));
      });

      expect(flow.id).toBe("test_flow");
      expect(flow.steps).toHaveLength(2);
      expect(flow.steps[0].toolName).toBe("tool_a");
      expect(flow.steps[1].toolName).toBe("tool_b");
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
      it("throws on duplicate toolName in devMode", () => {
        const flow = defineFlow("test_flow", (flow) => {
          flow.step("scan_repo", () => ({ nextTool: "first" }));
          flow.step("scan_repo", () => ({ nextTool: "second" }));
        });

        expect(() => createTaias({ flow, devMode: true })).toThrow(
          "Taias: Duplicate step for tool 'scan_repo' in flow 'test_flow'. Only one handler per tool is supported."
        );
      });

      it("does not throw on duplicate toolName when devMode is false", () => {
        const flow = defineFlow("test_flow", (flow) => {
          flow.step("scan_repo", () => ({ nextTool: "first" }));
          flow.step("scan_repo", () => ({ nextTool: "second" }));
        });

        expect(() => createTaias({ flow, devMode: false })).not.toThrow();
      });

      it("does not throw on duplicate toolName when devMode is not specified", () => {
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
            (call) => call[0]?.includes("is empty")
          );
          expect(emptyNextToolWarning).toBeUndefined();
        });
      });
    });
  });

  describe("integration", () => {
    it("works with the documented example", async () => {
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
  });
});
