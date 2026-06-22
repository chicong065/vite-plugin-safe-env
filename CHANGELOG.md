# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/2.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2026-06-22

### Changed

- Leak detection now follows your Vite `envPrefix` configuration (a string or an
  array of strings) instead of hardcoding `VITE_`. The resolved prefix is applied
  in both phases (the static source scan and the post-build bundle scan), so
  variables exposed through a custom prefix are recognized as client-safe rather
  than reported as leaks. Projects on the default `VITE_` prefix are unaffected.

## [1.0.1] - 2026-04-24

### Added

- Exported the `SafeEnvOptions` and `BlockOnMode` types from the package entry,
  so consumers can type their plugin configuration.

### Fixed

- Violations now surface in the development browser overlay when `blockOn` is set
  to `'always'`.

## [1.0.0] - 2026-04-24

### Added

- Initial release. Two-phase leak detection: a static scan of the module graph for
  `process.env` and `import.meta.env` accesses reachable from a client entry point,
  and a post-build scan of output chunks for the literal values of server-only
  variables. Configurable through `allowClientAccess`, `blockOn`, and
  `include`/`exclude`, with a development-mode browser overlay.
