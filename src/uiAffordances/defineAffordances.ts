import type {
  AffordanceRegistry,
  BindingInput,
  DefaultSlots,
  HandleRegistration,
} from "./types";
import { normalizeBinding } from "./types";

/**
 * Mapped type that creates a registration method for each slot in S.
 * This enables fully typed custom slots via generics.
 */
export type AffordanceRegistrar<S extends string = DefaultSlots> = {
  [K in S]: (handleId: string, bindsTo: BindingInput) => void;
};

/**
 * Define UI affordances for a widget using a builder pattern.
 *
 * @example Default slots (backwards compatible)
 * ```ts
 * const affordances = defineAffordances((r) => {
 *   r.primaryCta("cta.recommend", { toolName: "get_recommendations" });
 *   r.widgetVariant("variant.discovery", { toolName: "get_recommendations" });
 * });
 * ```
 *
 * @example Custom slots (fully type-safe)
 * ```ts
 * type MySlots = "primaryCta" | "contentArea" | "headerStyle";
 * const affordances = defineAffordances<MySlots>((r) => {
 *   r.primaryCta("cta.create", { toolName: "createUser" });
 *   r.contentArea("content.form", { key: "contentArea", value: "email-form" });
 *   r.headerStyle("header.progress", { key: "headerStyle", value: "step-1" });
 * });
 * ```
 */
export function defineAffordances<S extends string = DefaultSlots>(
  builder: (r: AffordanceRegistrar<S>) => void
): AffordanceRegistry<S> {
  const handles: HandleRegistration<S>[] = [];

  // Proxy creates methods on-the-fly for any slot name.
  // TypeScript ensures only valid slot names (from S) are called.
  const registrar = new Proxy({} as AffordanceRegistrar<S>, {
    get(_, slot: string) {
      return (handleId: string, bindsTo: BindingInput) => {
        handles.push({
          slot: slot as S,
          handleId,
          bindsTo: normalizeBinding(bindsTo),
        });
      };
    },
  });

  builder(registrar);
  return { handles };
}
