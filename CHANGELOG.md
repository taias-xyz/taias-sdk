# Changelog

## [0.4.1] - 2025-02-04

### Removed
- **`slotMatch` option** - No longer needed. The decision field for each slot is now automatically inferred from the handle bindings
  - Before: Required `slotMatch: { widgetVariant: "contentArea" }` alongside `{ key: "contentArea", value: "form" }`
  - After: Just define the binding - the key is inferred automatically
- `SlotMatch` type removed from exports

### Added
- **Conflict detection** - Throws helpful error if handles for the same slot bind to different keys
  - Example: `[Taias] Slot "primaryCta" has handles bound to different keys: "fieldA" and "fieldB"`

### Changed
- `SelectOptions` no longer accepts `slotMatch` parameter
- `TaiasOptions` no longer accepts `slotMatch` parameter
- Registry index now includes `slotKeyMap` for O(1) field lookup per slot

## [0.4.0] - 2025-02-04

### Added
- **Custom slots support** - Define your own slot types with full TypeScript type safety
  - Use generics to specify custom slots: `defineAffordances<MySlots>((r) => { ... })`
  - Proxy-based registrar dynamically creates typed methods for any slot name
  - Full autocomplete and compile-time error checking for custom slot names
- **`DefaultSlots` type** - Exported type for the three default slots (`primaryCta`, `secondaryCta`, `widgetVariant`)
- **`AffordanceRegistrar<S>` type** - Exported mapped type for custom registrar interfaces

### Changed
- All UI affordance types are now generic over slot type `S`:
  - `HandleRegistration<S>`, `AffordanceRegistry<S>`, `UiSelections<S>`, `SlotMatch<S>`
  - `Affordances<S>`, `TaiasOptions<S>`, `Taias<S>`
- `defineAffordances<S>()`, `mergeAffordances<S>()`, `createTaias<S>()` now accept generic slot type
- Selection logic iterates over registered slots instead of hardcoded list
- Registry index now tracks which slots have been registered

### Backwards Compatible
- All generics default to `DefaultSlots`, so existing code works unchanged
- `CanonicalSlot` remains as a deprecated alias for `DefaultSlots`

## [0.3.0] - 2025-02-04

### Added
- **Multi-field decision support** - Step handlers can now return custom fields beyond `nextTool`
  - Enables independent UI control for each slot (primaryCta, secondaryCta, widgetVariant)
  - Use `slotMatch` to map different slots to different decision fields
  - All custom fields are passed through to the `decision` object

### Changed
- `StepDecision` type now accepts additional string fields via index signature
- Decision extraction spreads all handler fields instead of only `nextTool`

## [0.2.1] - 2025-01-09

### Fixed
- Fixed incorrect import path for `Decision` type in `select.ts`

## [0.2.0] - 2025-01-09

### Added
- **UI Affordances system** - Control which UI components appear in widgets based on flow decisions
  - `defineAffordances()` - Register UI handles for slots (primaryCta, secondaryCta, widgetVariant)
  - `mergeAffordances()` - Combine multiple affordance registries with dev mode validation
  - `selections` output from `resolve()` - Automatically selected handles based on flow decision
- **Decision object** - `resolve()` now returns `decision` alongside `advice` and `selections`
- **slotMatch option** - Custom mapping of slots to decision fields (advanced use case)
- **Dev mode validations for affordances**:
  - Duplicate handleId detection
  - Ambiguous slot binding detection
  - Missing affordance warnings at resolve time
- Comprehensive test coverage for UI affordances

### Changed
- `resolve()` return type now includes `decision` and `selections` properties
- `TaiasOptions` accepts optional `affordances` and `slotMatch` parameters

## [0.1.0] - 2025-12-13

### Added
- Initial release
- Core Taias functionality