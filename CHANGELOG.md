# Changelog

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