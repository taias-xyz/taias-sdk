# Changelog

## [0.7.1] - 2026-02-18

### Changed
- Updated README to reflect v0.7.0 operator system (`is`, `isNot`, sugar forms)

## [0.7.0] - 2026-02-18

### Added
- **Operator system for match conditions** - Field conditions now support explicit comparison operators, enabling richer matching logic beyond simple equality
  - `Condition` type: `{ is: string } | { isNot: string }` -- pure data operators, no wrapper functions
  - `FieldCondition` type: `string | Condition` -- a bare string remains sugar for `{ is: string }`
  - `flow.step({ toolName: { is: "scan_repo" } }, ...)` -- explicit equality
  - `flow.step({ toolName: { isNot: "abort_session" } }, ...)` -- negation matching
- **Dual-path resolve strategy** - Build-time indexing adapts to the operators present in the flow
  - **Fast path**: When all steps use indexable operators (`is` / string sugar), resolve uses O(1) Map lookup (identical performance to v0.6.0)
  - **Full evaluation**: When any step uses non-indexable operators (`isNot`), resolve evaluates all steps in definition order (first match wins)
- **`Condition` and `FieldCondition` types exported** from `taias`

### Changed
- `MatchCondition.toolName` type widened from `string` to `FieldCondition` (accepts bare string, `{ is: string }`, or `{ isNot: string }`)
- Build-time indexing splits steps into `exactIndex` (Map for `is` conditions) and `broadSteps` (array for `isNot` conditions)
- Dev mode duplicate detection normalizes sugar forms before comparison -- bare `"scan_repo"`, `{ toolName: "scan_repo" }`, and `{ toolName: { is: "scan_repo" } }` are all recognized as duplicates of each other

### Backwards Compatible
- All three sugar forms produce identical behavior: `"scan_repo"` = `{ toolName: "scan_repo" }` = `{ toolName: { is: "scan_repo" } }`
- Flows using only `is` / string sugar conditions use the same O(1) Map lookup as v0.6.0

## [0.6.0] - 2026-02-17

### Added
- **Logic statements** - Flow logic is now a first-class domain concept expressed as structured data
  - `LogicStatement` type: `{ match: MatchCondition; decision: StepDecision }` -- the core primitive of the decision engine
  - `MatchCondition` type: currently `{ toolName: string }`, designed to expand with additional match fields
  - `StepInput` type: union of `StepHandler | StepDecision` accepted by `flow.step()`
- **`FlowStep` discriminated union** - Steps are now `{ kind: "logic"; statement: LogicStatement }` or `{ kind: "handler"; match: MatchCondition; handler: StepHandler }`
  - Logic-based steps: the statement is the sole source of truth for match conditions and decision
  - Handler-based steps: backwards-compatible escape hatch for function-based logic, with match condition stored alongside handler
- **`flow.step()` accepts `MatchCondition` as first argument** - The match condition is now a structured object, not a bare toolName
  - `flow.step({ toolName: "scan_repo" }, { nextTool: "configure_app" })` -- explicit match condition
  - `flow.step("scan_repo", { nextTool: "configure_app" })` -- string sugar for `{ toolName: "scan_repo" }`
  - Both forms work with logic statements (static decisions) and handler functions (backwards compatibility)

### Changed
- `FlowBuilder.step()` first argument is now `string | MatchCondition` (was `string`)
- Handler-based `FlowStep` stores `match: MatchCondition` instead of bare `toolName: string`
- `createTaias` build-time indexing derives keys from match conditions generically (not hardcoded to toolName)
- Resolve path branches on `FlowStep.kind`: logic statements return the decision directly (no function invocation), handler steps call the function
- Dev mode duplicate detection checks match conditions, not just toolName strings

### Backwards Compatible
- String form `flow.step("scan_repo", ...)` still works as sugar for `{ toolName: "scan_repo" }`
- All existing handler-based code works unchanged
- `resolve()` output shape is identical for both logic and handler steps

## [0.5.0] - 2026-02-13

### Added
- **`params` and `result` on `TaiasContext`** - Step handlers can now access tool input parameters and tool execution output to make conditional decisions
  - `params`: The input parameters of the tool call (`Record<string, unknown>`)
  - `result`: The output of the tool's execution (`Record<string, unknown>`)
  - Both fields are optional — existing code works unchanged

### Backwards Compatible
- `params` and `result` are optional fields; omitting them produces identical behavior to previous versions

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