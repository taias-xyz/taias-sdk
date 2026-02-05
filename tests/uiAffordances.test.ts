import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  defineFlow,
  createTaias,
  defineAffordances,
  mergeAffordances,
} from "../src";
import type { AffordanceRegistry } from "../src";

describe("UI Affordances", () => {
  describe("defineAffordances", () => {
    it("creates a registry with primaryCta handles", () => {
      const registry = defineAffordances((r) => {
        r.primaryCta("tracks.cta.recommend", { toolName: "get_recommendations" });
        r.primaryCta("tracks.cta.playlist", { toolName: "create_playlist" });
      });

      expect(registry.handles).toHaveLength(2);
      expect(registry.handles[0]).toEqual({
        slot: "primaryCta",
        handleId: "tracks.cta.recommend",
        bindsTo: { key: "nextTool", value: "get_recommendations" },
      });
      expect(registry.handles[1]).toEqual({
        slot: "primaryCta",
        handleId: "tracks.cta.playlist",
        bindsTo: { key: "nextTool", value: "create_playlist" },
      });
    });

    it("creates a registry with secondaryCta handles", () => {
      const registry = defineAffordances((r) => {
        r.secondaryCta("tracks.secondary.share", { toolName: "share_tracks" });
      });

      expect(registry.handles).toHaveLength(1);
      expect(registry.handles[0]).toEqual({
        slot: "secondaryCta",
        handleId: "tracks.secondary.share",
        bindsTo: { key: "nextTool", value: "share_tracks" },
      });
    });

    it("creates a registry with widgetVariant handles", () => {
      const registry = defineAffordances((r) => {
        r.widgetVariant("tracks.variant.discovery", { toolName: "get_recommendations" });
        r.widgetVariant("tracks.variant.playlist", { toolName: "create_playlist" });
      });

      expect(registry.handles).toHaveLength(2);
      expect(registry.handles[0].slot).toBe("widgetVariant");
      expect(registry.handles[1].slot).toBe("widgetVariant");
    });

    it("supports generalized binding format", () => {
      const registry = defineAffordances((r) => {
        r.primaryCta("custom.cta", { key: "customField", value: "customValue" });
      });

      expect(registry.handles[0].bindsTo).toEqual({
        key: "customField",
        value: "customValue",
      });
    });

    it("creates an empty registry when no handles are defined", () => {
      const registry = defineAffordances(() => {});

      expect(registry.handles).toHaveLength(0);
    });

    it("supports mixed slot types in a single registry", () => {
      const registry = defineAffordances((r) => {
        r.primaryCta("cta.primary", { toolName: "tool_a" });
        r.secondaryCta("cta.secondary", { toolName: "tool_b" });
        r.widgetVariant("variant.main", { toolName: "tool_c" });
      });

      expect(registry.handles).toHaveLength(3);
      expect(registry.handles.map((h) => h.slot)).toEqual([
        "primaryCta",
        "secondaryCta",
        "widgetVariant",
      ]);
    });
  });

  describe("mergeAffordances", () => {
    it("merges multiple registries into one", () => {
      const registry1 = defineAffordances((r) => {
        r.primaryCta("widget1.cta", { toolName: "tool_a" });
      });
      const registry2 = defineAffordances((r) => {
        r.primaryCta("widget2.cta", { toolName: "tool_b" });
      });

      const merged = mergeAffordances([registry1, registry2]);

      expect(merged.handles).toHaveLength(2);
      expect(merged.handles[0].handleId).toBe("widget1.cta");
      expect(merged.handles[1].handleId).toBe("widget2.cta");
    });

    it("merges empty registries", () => {
      const merged = mergeAffordances([]);
      expect(merged.handles).toHaveLength(0);
    });

    describe("devMode validations", () => {
      it("throws on duplicate handleId", () => {
        const registry1 = defineAffordances((r) => {
          r.primaryCta("duplicate.cta", { toolName: "tool_a" });
        });
        const registry2 = defineAffordances((r) => {
          r.primaryCta("duplicate.cta", { toolName: "tool_b" });
        });

        expect(() =>
          mergeAffordances([registry1, registry2], { devMode: true })
        ).toThrow('[Taias] Duplicate handleId "duplicate.cta"');
      });

      it("throws on ambiguous slot binding (same slot + key + value)", () => {
        const registry = defineAffordances((r) => {
          r.primaryCta("option-a", { toolName: "get_recommendations" });
          r.primaryCta("option-b", { toolName: "get_recommendations" });
        });

        expect(() => mergeAffordances([registry], { devMode: true })).toThrow(
          '[Taias] Ambiguous affordance: slot "primaryCta" has multiple handles bound to (nextTool="get_recommendations")'
        );
      });

      it("does not throw on duplicate handleId when devMode is false", () => {
        const registry1 = defineAffordances((r) => {
          r.primaryCta("duplicate.cta", { toolName: "tool_a" });
        });
        const registry2 = defineAffordances((r) => {
          r.primaryCta("duplicate.cta", { toolName: "tool_b" });
        });

        expect(() =>
          mergeAffordances([registry1, registry2], { devMode: false })
        ).not.toThrow();
      });

      it("allows same toolName for different slots", () => {
        const registry = defineAffordances((r) => {
          r.primaryCta("primary.recommend", { toolName: "get_recommendations" });
          r.secondaryCta("secondary.recommend", { toolName: "get_recommendations" });
          r.widgetVariant("variant.recommend", { toolName: "get_recommendations" });
        });

        expect(() => mergeAffordances([registry], { devMode: true })).not.toThrow();
      });

      it("calls onWarn with handle count in devMode", () => {
        const onWarn = vi.fn();
        const registry = defineAffordances((r) => {
          r.primaryCta("cta1", { toolName: "tool_a" });
          r.primaryCta("cta2", { toolName: "tool_b" });
        });

        mergeAffordances([registry], { devMode: true, onWarn });

        expect(onWarn).toHaveBeenCalledWith(
          "[Taias] Loaded 2 UI affordance handles"
        );
      });
    });
  });

  describe("resolve() with UI affordances", () => {
    it("returns selections based on flow decision", async () => {
      const flow = defineFlow("test_flow", (flow) => {
        flow.step("get_recent_tracks", () => ({
          nextTool: "get_recommendations",
        }));
      });

      const affordances = defineAffordances((r) => {
        r.primaryCta("tracks.cta.recommend", { toolName: "get_recommendations" });
        r.primaryCta("tracks.cta.playlist", { toolName: "create_playlist" });
      });

      const taias = createTaias({
        flow,
        affordances: mergeAffordances([affordances]),
      });

      const result = await taias.resolve({ toolName: "get_recent_tracks" });

      expect(result).not.toBeNull();
      expect(result?.selections.primaryCta).toEqual({
        handleId: "tracks.cta.recommend",
        bindsTo: { key: "nextTool", value: "get_recommendations" },
      });
    });

    it("selects correct handle when flow changes", async () => {
      const flow = defineFlow("test_flow", (flow) => {
        flow.step("get_recent_tracks", () => ({
          nextTool: "create_playlist",
        }));
      });

      const affordances = defineAffordances((r) => {
        r.primaryCta("tracks.cta.recommend", { toolName: "get_recommendations" });
        r.primaryCta("tracks.cta.playlist", { toolName: "create_playlist" });
      });

      const taias = createTaias({
        flow,
        affordances: mergeAffordances([affordances]),
      });

      const result = await taias.resolve({ toolName: "get_recent_tracks" });

      expect(result?.selections.primaryCta?.handleId).toBe("tracks.cta.playlist");
    });

    it("returns decision object alongside selections", async () => {
      const flow = defineFlow("test_flow", (flow) => {
        flow.step("tool_a", () => ({ nextTool: "tool_b" }));
      });

      const taias = createTaias({ flow });
      const result = await taias.resolve({ toolName: "tool_a" });

      expect(result?.decision).toEqual({ nextTool: "tool_b" });
    });

    it("returns empty selections when no affordances match", async () => {
      const flow = defineFlow("test_flow", (flow) => {
        flow.step("tool_a", () => ({ nextTool: "unregistered_tool" }));
      });

      const affordances = defineAffordances((r) => {
        r.primaryCta("cta.other", { toolName: "other_tool" });
      });

      const taias = createTaias({
        flow,
        affordances: mergeAffordances([affordances]),
      });

      const result = await taias.resolve({ toolName: "tool_a" });

      expect(result?.selections).toEqual({});
    });

    it("returns empty selections when no affordances registry is provided", async () => {
      const flow = defineFlow("test_flow", (flow) => {
        flow.step("tool_a", () => ({ nextTool: "tool_b" }));
      });

      const taias = createTaias({ flow });
      const result = await taias.resolve({ toolName: "tool_a" });

      expect(result?.selections).toEqual({});
    });

    it("selects handles for multiple slots simultaneously", async () => {
      const flow = defineFlow("test_flow", (flow) => {
        flow.step("tool_a", () => ({ nextTool: "tool_b" }));
      });

      const affordances = defineAffordances((r) => {
        r.primaryCta("primary.b", { toolName: "tool_b" });
        r.secondaryCta("secondary.b", { toolName: "tool_b" });
        r.widgetVariant("variant.b", { toolName: "tool_b" });
      });

      const taias = createTaias({
        flow,
        affordances: mergeAffordances([affordances]),
      });

      const result = await taias.resolve({ toolName: "tool_a" });

      expect(result?.selections.primaryCta?.handleId).toBe("primary.b");
      expect(result?.selections.secondaryCta?.handleId).toBe("secondary.b");
      expect(result?.selections.widgetVariant?.handleId).toBe("variant.b");
    });
  });

  describe("multi-field decisions", () => {
    it("passes custom fields through to decision object", async () => {
      const flow = defineFlow("test_flow", (flow) => {
        flow.step("tool_a", () => ({
          nextTool: "tool_b",
          customField: "custom_value",
        }));
      });

      const taias = createTaias({ flow });
      const result = await taias.resolve({ toolName: "tool_a" });

      expect(result?.decision).toEqual({
        nextTool: "tool_b",
        customField: "custom_value",
      });
    });

    it("allows different slots to match different decision fields (inferred from bindings)", async () => {
      const flow = defineFlow("test_flow", (flow) => {
        flow.step("tool_a", () => ({
          nextTool: "primary_tool",
          secondaryAction: "secondary_tool",
          contentArea: "content_variant",
        }));
      });

      // Each binding declares which decision field it matches - no slotMatch needed
      const affordances = defineAffordances((r) => {
        r.primaryCta("cta.primary", { key: "nextTool", value: "primary_tool" });
        r.secondaryCta("cta.secondary", { key: "secondaryAction", value: "secondary_tool" });
        r.widgetVariant("variant.content", { key: "contentArea", value: "content_variant" });
      });

      const taias = createTaias({
        flow,
        affordances: mergeAffordances([affordances]),
      });

      const result = await taias.resolve({ toolName: "tool_a" });

      expect(result?.selections.primaryCta?.handleId).toBe("cta.primary");
      expect(result?.selections.secondaryCta?.handleId).toBe("cta.secondary");
      expect(result?.selections.widgetVariant?.handleId).toBe("variant.content");
    });

    it("supports onboarding flow use case with independent slot decisions", async () => {
      // Simulates the developer feedback use case
      const onboardingFlow = defineFlow("onboarding_flow", (flow) => {
        flow.step("createUser", () => ({
          nextTool: "startImport",
          primaryAction: "startImport",
          secondaryAction: "startManualSetup",
          contentArea: "path-choice",
        }));
      });

      // Each binding declares its key - decision field is inferred automatically
      const affordances = defineAffordances((r) => {
        // Primary CTA - the recommended path
        r.primaryCta("cta.start-import", { key: "primaryAction", value: "startImport" });
        // Secondary CTA - the alternative path
        r.secondaryCta("cta.start-manual", { key: "secondaryAction", value: "startManualSetup" });
        // Widget variant - which content to show
        r.widgetVariant("content.path-choice", { key: "contentArea", value: "path-choice" });
      });

      const taias = createTaias({
        flow: onboardingFlow,
        affordances: mergeAffordances([affordances]),
      });

      const result = await taias.resolve({ toolName: "createUser" });

      // LLM advice still uses nextTool
      expect(result?.advice).toContain("startImport");

      // Each slot matches its own decision field (inferred from bindings)
      expect(result?.selections.primaryCta?.handleId).toBe("cta.start-import");
      expect(result?.selections.secondaryCta?.handleId).toBe("cta.start-manual");
      expect(result?.selections.widgetVariant?.handleId).toBe("content.path-choice");

      // Decision object contains all fields
      expect(result?.decision).toEqual({
        nextTool: "startImport",
        primaryAction: "startImport",
        secondaryAction: "startManualSetup",
        contentArea: "path-choice",
      });
    });

    it("maintains backwards compatibility with nextTool-only handlers", async () => {
      const flow = defineFlow("test_flow", (flow) => {
        flow.step("tool_a", () => ({ nextTool: "tool_b" }));
      });

      const affordances = defineAffordances((r) => {
        r.primaryCta("cta.b", { toolName: "tool_b" });
        r.secondaryCta("secondary.b", { toolName: "tool_b" });
      });

      const taias = createTaias({
        flow,
        affordances: mergeAffordances([affordances]),
      });

      const result = await taias.resolve({ toolName: "tool_a" });

      // Should work exactly as before
      expect(result?.decision).toEqual({ nextTool: "tool_b" });
      expect(result?.selections.primaryCta?.handleId).toBe("cta.b");
      expect(result?.selections.secondaryCta?.handleId).toBe("secondary.b");
    });
  });

  describe("devMode warnings for missing affordances", () => {
    let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    });

    afterEach(() => {
      consoleWarnSpy.mockRestore();
    });

    it("warns when no affordance exists for a slot in devMode", async () => {
      const flow = defineFlow("test_flow", (flow) => {
        flow.step("tool_a", () => ({ nextTool: "unregistered_tool" }));
      });

      const affordances = defineAffordances((r) => {
        r.primaryCta("cta.other", { toolName: "other_tool" });
      });

      const taias = createTaias({
        flow,
        affordances: mergeAffordances([affordances]),
        devMode: true,
      });

      await taias.resolve({ toolName: "tool_a" });

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[Taias] No affordance for slot "primaryCta" when nextTool="unregistered_tool"'
      );
    });

    it("does not warn when devMode is false", async () => {
      const flow = defineFlow("test_flow", (flow) => {
        flow.step("tool_a", () => ({ nextTool: "unregistered_tool" }));
      });

      const affordances = defineAffordances((r) => {
        r.primaryCta("cta.other", { toolName: "other_tool" });
      });

      const taias = createTaias({
        flow,
        affordances: mergeAffordances([affordances]),
        devMode: false,
      });

      await taias.resolve({ toolName: "tool_a" });

      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it("uses custom onWarn handler", async () => {
      const onWarn = vi.fn();

      const flow = defineFlow("test_flow", (flow) => {
        flow.step("tool_a", () => ({ nextTool: "unregistered_tool" }));
      });

      const affordances = defineAffordances((r) => {
        r.primaryCta("cta.other", { toolName: "other_tool" });
      });

      const taias = createTaias({
        flow,
        affordances: mergeAffordances([affordances]),
        devMode: true,
        onWarn,
      });

      await taias.resolve({ toolName: "tool_a" });

      expect(onWarn).toHaveBeenCalledWith(
        '[Taias] No affordance for slot "primaryCta" when nextTool="unregistered_tool"'
      );
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });
  });

  describe("integration: music discovery example from docs", () => {
    it("works with the documented music discovery flow", async () => {
      // Define flow exactly as shown in docs
      const musicDiscoveryFlow = defineFlow("music_discovery_flow", (flow) => {
        flow.step("get_recent_tracks", () => ({
          nextTool: "get_recommendations",
        }));

        flow.step("get_recommendations", () => ({
          nextTool: "create_playlist",
        }));
      });

      // Define affordances exactly as shown in docs
      const trackListAffordances = defineAffordances((r) => {
        r.primaryCta("tracks.cta.recommend", { toolName: "get_recommendations" });
        r.primaryCta("tracks.cta.playlist", { toolName: "create_playlist" });
        r.widgetVariant("tracks.variant.discovery", { toolName: "get_recommendations" });
        r.widgetVariant("tracks.variant.playlist", { toolName: "create_playlist" });
      });

      const taias = createTaias({
        flow: musicDiscoveryFlow,
        affordances: mergeAffordances([trackListAffordances]),
      });

      // After get_recent_tracks, should suggest get_recommendations
      const afterRecentTracks = await taias.resolve({ toolName: "get_recent_tracks" });
      expect(afterRecentTracks?.advice).toContain("get_recommendations");
      expect(afterRecentTracks?.decision.nextTool).toBe("get_recommendations");
      expect(afterRecentTracks?.selections.primaryCta?.handleId).toBe("tracks.cta.recommend");
      expect(afterRecentTracks?.selections.widgetVariant?.handleId).toBe("tracks.variant.discovery");

      // After get_recommendations, should suggest create_playlist
      const afterRecommendations = await taias.resolve({ toolName: "get_recommendations" });
      expect(afterRecommendations?.advice).toContain("create_playlist");
      expect(afterRecommendations?.decision.nextTool).toBe("create_playlist");
      expect(afterRecommendations?.selections.primaryCta?.handleId).toBe("tracks.cta.playlist");
      expect(afterRecommendations?.selections.widgetVariant?.handleId).toBe("tracks.variant.playlist");
    });
  });

  describe("custom slots", () => {
    it("registers handles for custom slots", () => {
      type MySlots = "primaryCta" | "contentArea";
      const registry = defineAffordances<MySlots>((r) => {
        r.primaryCta("cta.create", { toolName: "createUser" });
        r.contentArea("content.form", { toolName: "createUser" });
      });

      expect(registry.handles).toHaveLength(2);
      expect(registry.handles[0].slot).toBe("primaryCta");
      expect(registry.handles[1].slot).toBe("contentArea");
    });

    it("selects handles for custom slots (inferred from bindings)", async () => {
      type MySlots = "primaryCta" | "contentArea";

      const flow = defineFlow("test_flow", (f) => {
        f.step("tool_a", () => ({
          nextTool: "tool_b",
          contentArea: "form_b",
        }));
      });

      // Each binding declares its key - no slotMatch needed
      const affordances = defineAffordances<MySlots>((r) => {
        r.primaryCta("cta.b", { toolName: "tool_b" });
        r.contentArea("content.b", { key: "contentArea", value: "form_b" });
      });

      const taias = createTaias<MySlots>({
        flow,
        affordances: mergeAffordances([affordances]),
      });

      const result = await taias.resolve({ toolName: "tool_a" });

      expect(result?.selections.primaryCta?.handleId).toBe("cta.b");
      expect(result?.selections.contentArea?.handleId).toBe("content.b");
    });

    it("only selects registered slots (ignores unregistered canonical slots)", async () => {
      type MySlots = "contentArea";

      const flow = defineFlow("test_flow", (f) => {
        f.step("tool_a", () => ({ nextTool: "tool_b" }));
      });

      const affordances = defineAffordances<MySlots>((r) => {
        r.contentArea("content.b", { toolName: "tool_b" });
      });

      const taias = createTaias<MySlots>({
        flow,
        affordances: mergeAffordances([affordances]),
      });

      const result = await taias.resolve({ toolName: "tool_a" });

      // Only contentArea should be selected (defaults to nextTool)
      expect(result?.selections.contentArea?.handleId).toBe("content.b");
      // primaryCta and others should not exist since not registered
      expect(Object.keys(result?.selections ?? {})).toEqual(["contentArea"]);
    });

    it("supports fully custom slot sets without canonical slots", async () => {
      type DashboardSlots = "headerWidget" | "mainPanel" | "sidebar";

      const flow = defineFlow("dashboard_flow", (f) => {
        f.step("load_dashboard", () => ({
          nextTool: "refresh",
          headerWidget: "stats",
          mainPanel: "chart",
          sidebar: "filters",
        }));
      });

      // Bindings declare the key - decision field is inferred automatically
      const affordances = defineAffordances<DashboardSlots>((r) => {
        r.headerWidget("header.stats", { key: "headerWidget", value: "stats" });
        r.mainPanel("main.chart", { key: "mainPanel", value: "chart" });
        r.sidebar("sidebar.filters", { key: "sidebar", value: "filters" });
      });

      const taias = createTaias<DashboardSlots>({
        flow,
        affordances: mergeAffordances([affordances]),
      });

      const result = await taias.resolve({ toolName: "load_dashboard" });

      expect(result?.selections.headerWidget?.handleId).toBe("header.stats");
      expect(result?.selections.mainPanel?.handleId).toBe("main.chart");
      expect(result?.selections.sidebar?.handleId).toBe("sidebar.filters");
    });

    it("full onboarding flow integration with custom slots", async () => {
      type OnboardingSlots = "primaryCta" | "secondaryCta" | "contentArea" | "headerStyle";

      const flow = defineFlow("onboarding", (f) => {
        f.step("createUser", () => ({
          nextTool: "startImport",
          primaryAction: "startImport",
          secondaryAction: "manualSetup",
          contentArea: "path-choice",
          headerStyle: "progress",
        }));
      });

      // Each binding declares its key - decision fields are inferred automatically
      const affordances = defineAffordances<OnboardingSlots>((r) => {
        r.primaryCta("cta.import", { key: "primaryAction", value: "startImport" });
        r.secondaryCta("cta.manual", { key: "secondaryAction", value: "manualSetup" });
        r.contentArea("content.path-choice", { key: "contentArea", value: "path-choice" });
        r.headerStyle("header.progress", { key: "headerStyle", value: "progress" });
      });

      const taias = createTaias<OnboardingSlots>({
        flow,
        affordances: mergeAffordances([affordances]),
      });

      const result = await taias.resolve({ toolName: "createUser" });

      // LLM advice still uses nextTool
      expect(result?.advice).toContain("startImport");

      // Each slot matches its own decision field (inferred from bindings)
      expect(result?.selections.primaryCta?.handleId).toBe("cta.import");
      expect(result?.selections.secondaryCta?.handleId).toBe("cta.manual");
      expect(result?.selections.contentArea?.handleId).toBe("content.path-choice");
      expect(result?.selections.headerStyle?.handleId).toBe("header.progress");

      // Decision object contains all fields
      expect(result?.decision).toEqual({
        nextTool: "startImport",
        primaryAction: "startImport",
        secondaryAction: "manualSetup",
        contentArea: "path-choice",
        headerStyle: "progress",
      });
    });

    it("type-checks slot names at compile time", () => {
      type MySlots = "primaryCta" | "contentArea";

      // This test verifies the Proxy-based approach works at runtime
      // TypeScript catches invalid slots at compile time (verified manually)
      const registry = defineAffordances<MySlots>((r) => {
        r.primaryCta("cta", { toolName: "x" });
        r.contentArea("content", { toolName: "x" });
        // r.invalidSlot("x", { toolName: "x" }); // Would be a type error
      });

      expect(registry.handles).toHaveLength(2);
    });

    it("merges custom slot registries correctly", () => {
      type MySlots = "primaryCta" | "contentArea";

      const registry1 = defineAffordances<MySlots>((r) => {
        r.primaryCta("cta.a", { toolName: "tool_a" });
      });

      const registry2 = defineAffordances<MySlots>((r) => {
        r.contentArea("content.b", { toolName: "tool_b" });
      });

      const merged = mergeAffordances<MySlots>([registry1, registry2]);

      expect(merged.handles).toHaveLength(2);
      expect(merged.handles[0].slot).toBe("primaryCta");
      expect(merged.handles[1].slot).toBe("contentArea");
    });
  });

  describe("key inference from bindings", () => {
    it("infers decision field from affordance bindings", async () => {
      const flow = defineFlow("test_flow", (f) => {
        f.step("tool_a", () => ({
          nextTool: "tool_b",
          customField: "custom_value",
        }));
      });

      // primaryCta uses nextTool (via toolName shorthand)
      // widgetVariant uses customField (via explicit key)
      const affordances = defineAffordances((r) => {
        r.primaryCta("cta.b", { toolName: "tool_b" });
        r.widgetVariant("variant.custom", { key: "customField", value: "custom_value" });
      });

      const taias = createTaias({
        flow,
        affordances: mergeAffordances([affordances]),
      });

      const result = await taias.resolve({ toolName: "tool_a" });

      // Both should be selected - keys inferred from bindings
      expect(result?.selections.primaryCta?.handleId).toBe("cta.b");
      expect(result?.selections.widgetVariant?.handleId).toBe("variant.custom");
    });

    it("throws on conflicting keys for same slot", () => {
      const affordances = defineAffordances((r) => {
        r.primaryCta("cta.a", { key: "fieldA", value: "value_a" });
        r.primaryCta("cta.b", { key: "fieldB", value: "value_b" }); // Different key!
      });

      const flow = defineFlow("test_flow", (f) => {
        f.step("tool_a", () => ({ nextTool: "x" }));
      });

      // Should throw when building the index (during createTaias)
      expect(() =>
        createTaias({
          flow,
          affordances: mergeAffordances([affordances]),
        })
      ).toThrow(
        '[Taias] Slot "primaryCta" has handles bound to different keys: "fieldA" and "fieldB"'
      );
    });

    it("allows same key across different slots", async () => {
      const flow = defineFlow("test_flow", (f) => {
        f.step("tool_a", () => ({ nextTool: "tool_b" }));
      });

      // All slots use nextTool - this is fine
      const affordances = defineAffordances((r) => {
        r.primaryCta("cta.b", { toolName: "tool_b" });
        r.secondaryCta("secondary.b", { toolName: "tool_b" });
        r.widgetVariant("variant.b", { toolName: "tool_b" });
      });

      const taias = createTaias({
        flow,
        affordances: mergeAffordances([affordances]),
      });

      const result = await taias.resolve({ toolName: "tool_a" });

      expect(result?.selections.primaryCta?.handleId).toBe("cta.b");
      expect(result?.selections.secondaryCta?.handleId).toBe("secondary.b");
      expect(result?.selections.widgetVariant?.handleId).toBe("variant.b");
    });

    it("allows multiple handles for same slot with same key but different values", async () => {
      const flow = defineFlow("test_flow", (f) => {
        f.step("tool_a", () => ({ nextTool: "tool_b" }));
        f.step("tool_b", () => ({ nextTool: "tool_c" }));
      });

      // Multiple primaryCta handles, all using nextTool but with different values
      const affordances = defineAffordances((r) => {
        r.primaryCta("cta.b", { toolName: "tool_b" });
        r.primaryCta("cta.c", { toolName: "tool_c" });
      });

      const taias = createTaias({
        flow,
        affordances: mergeAffordances([affordances]),
      });

      const resultA = await taias.resolve({ toolName: "tool_a" });
      expect(resultA?.selections.primaryCta?.handleId).toBe("cta.b");

      const resultB = await taias.resolve({ toolName: "tool_b" });
      expect(resultB?.selections.primaryCta?.handleId).toBe("cta.c");
    });
  });
});

