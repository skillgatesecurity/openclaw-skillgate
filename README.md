# SkillGate

Supply-chain governance plugin for OpenClaw — scan, assess, and quarantine risky skills.

## 30-Second Quick Start

```bash
# Install
npm install @skillgate/openclaw-skillgate@0.1.0

# Scan all skills for HIGH+ risks
/gov scan

# Quarantine a risky skill
/gov quarantine some-risky-skill

# Restore if needed
/gov restore some-risky-skill
```

## Features

- **Three-layer scanning**: workspace, managed, and extraDirs skills
- **Risk scoring**: Composite model with combo detection (not single red flags)
- **CRITICAL detection**: `curl|bash`, `wget|sh`, `base64|sh`, `rm -rf` patterns
- **Soft quarantine**: Backup + atomic disable (reversible)
- **Evidence redaction**: Sensitive snippets hashed, not stored
- **Fail-closed auth**: Write operations require confirmation

## Commands

| Command | Description |
|---------|-------------|
| `/gov scan` | Scan skills for risks (default: HIGH+) |
| `/gov scan --all` | Show all findings including LOW/INFO |
| `/gov scan --json` | Output as JSON |
| `/gov quarantine <skill>` | Quarantine a skill |
| `/gov restore <skill>` | Restore a quarantined skill |
| `/gov allow <skill>` | Allowlist a skill |
| `/gov explain <skill>` | Explain why flagged |
| `/gov status` | Show governance status |

## Risk Levels & Actions

| Level | Auto Action | Description |
|-------|-------------|-------------|
| CRITICAL | Quarantine | Shell injection, supply-chain attacks |
| HIGH | Disable | Dangerous patterns, external downloads |
| MEDIUM | Warn | Risky but not immediately dangerous |
| LOW/INFO | Log | Informational only |

## Configuration

SkillGate reads/writes to `~/.openclaw/openclaw.json`:

```json5
{
  "skills": {
    "entries": {
      "my-skill": {
        "enabled": true,
        // SkillGate adds when quarantined:
        "_quarantine": {
          "timestamp": "2026-02-21T00:00:00Z",
          "reason": "CRITICAL: curl|bash detected",
          "evidenceId": "ev-abc123"
        }
      }
    }
  }
}
```

## Evidence

Evidence packages are stored in `~/.openclaw/evidence/` with redacted snippets:

```json
{
  "skillKey": "risky-skill",
  "scanTimestamp": "2026-02-21T00:00:00Z",
  "findings": [
    {
      "rule": "shell-injection",
      "severity": "CRITICAL",
      "file": "install.sh",
      "line": 42,
      "snippet_redacted": true,
      "snippet_hash": "sha256:abc123...",
      "redaction_applied": true
    }
  ]
}
```

## License

MIT © SkillGate Contributors
