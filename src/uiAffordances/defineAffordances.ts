import type {
    AffordanceRegistry,
    BindingInput,
    CanonicalSlot,
    HandleRegistration,
  } from "./types";
  import { normalizeBinding } from "./types";
  
  type RegistrarFn = (handleId: string, bindsTo: BindingInput) => void;
  
  export interface AffordanceRegistrar {
    primaryCta: RegistrarFn;
    secondaryCta: RegistrarFn;
    widgetVariant: RegistrarFn;
  }
  
  export function defineAffordances(builder: (r: AffordanceRegistrar) => void): AffordanceRegistry {
    const handles: HandleRegistration[] = [];
  
    const push = (slot: CanonicalSlot, handleId: string, bindsTo: BindingInput) => {
      handles.push({
        slot,
        handleId,
        bindsTo: normalizeBinding(bindsTo),
      });
    };
  
    const registrar: AffordanceRegistrar = {
      primaryCta: (handleId, bindsTo) => push("primaryCta", handleId, bindsTo),
      secondaryCta: (handleId, bindsTo) => push("secondaryCta", handleId, bindsTo),
      widgetVariant: (handleId, bindsTo) => push("widgetVariant", handleId, bindsTo),
    };
  
    builder(registrar);
    return { handles };
  }
  