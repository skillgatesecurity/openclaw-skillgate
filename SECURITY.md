# Security Policy

## Reporting Vulnerabilities

If you discover a security vulnerability in SkillGate, please report it responsibly:

1. **DO NOT** create a public GitHub issue
2. Email: security@skillgate.dev (or open a private security advisory on GitHub)
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

We will respond within 48 hours and work with you to address the issue.

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |

## Security Design Principles

### Fail-Closed Authorization

All write operations (`quarantine`, `restore`, `allow`) require explicit user confirmation. The system never assumes consent.

### Evidence Redaction

Sensitive code snippets are never stored in plaintext. All evidence uses:
- `snippet_redacted: true`
- `snippet_hash: sha256:...` for verification
- `redaction_applied: true` flag

### Atomic Operations

Config file writes use atomic rename pattern:
1. Write to `.tmp` file
2. Verify integrity
3. Atomic rename to target

### No Remote Code Execution

SkillGate:
- Never executes code from scanned skills
- Never fetches remote resources during scan
- Operates entirely offline

### Minimal Permissions

The plugin only:
- Reads skill directories
- Reads/writes `~/.openclaw/openclaw.json`
- Writes to `~/.openclaw/evidence/`

## Known Limitations

1. **Obfuscated code**: Heavily obfuscated malicious code may evade pattern detection
2. **Dynamic generation**: Code that generates malicious payloads at runtime may not be caught
3. **Zero-day patterns**: New attack vectors require rule updates

## Changelog

Security-relevant changes are noted in [CHANGELOG.md](./CHANGELOG.md).
