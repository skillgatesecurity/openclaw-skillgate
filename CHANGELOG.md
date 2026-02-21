# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.2] - 2026-02-21

### Changed

- **Release workflow hardened**: Tag must be semantic versioning (`v*.*.*`) and commit must be on `main` branch
- Removed unused imports across codebase (eslint cleanup)

### Added

- `docs/demo.md` — Detailed walkthrough with sample outputs
- `docs/adr/001-npm-oidc-publishing.md` — Plan for NPM OIDC migration
- CI badges in README

### Fixed

- ESLint errors that caused CI to fail
- Unnecessary escape characters in regex patterns

## [0.1.1] - 2026-02-21

### Fixed

- Repository URL in package.json (was `skillgate/`, now `skillgatesecurity/`)

## [0.1.0] - 2026-02-21

### Added

- Initial release
- Core scanning engine with three-layer discovery (workspace, managed, extraDirs)
- Risk scoring model with combo detection
- CRITICAL pattern detection: `curl|bash`, `wget|sh`, `base64|sh`, `rm -rf`
- Soft quarantine with backup and atomic writes
- Evidence generation with snippet redaction
- Commands: `/gov scan`, `/gov quarantine`, `/gov restore`, `/gov allow`, `/gov explain`, `/gov status`
- JSON5 config file support (preserves comments)
- Fail-closed authorization for write operations
- MIT license

### Security

- All write operations require explicit user confirmation
- Evidence snippets are hashed, not stored in plaintext
- Atomic file writes prevent corruption
