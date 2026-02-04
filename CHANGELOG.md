# Changelog

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