# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
