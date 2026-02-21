# SkillGate Demo

## Three-Layer Scanning

SkillGate scans skills from three sources:

| Source | Path | Priority |
|--------|------|----------|
| **workspace** | Current directory | User's active project |
| **managed** | `~/.openclaw/skills/` | Installed skills |
| **extraDirs** | From `openclaw.json` | Custom skill directories |

Each finding includes the source tag for traceability.

## Risk Levels

| Level | Score | Auto Action | Description |
|-------|-------|-------------|-------------|
| **CRITICAL** | 100+ | Quarantine | `curl\|bash`, `rm -rf /`, supply-chain attacks |
| **HIGH** | 50+ | Disable | Hardcoded secrets, shell injection, external downloads |
| **MEDIUM** | 20+ | Warn | Network listeners, dynamic requires, obfuscation |
| **LOW** | 5+ | Log | Shell exec, network requests, filesystem access |
| **INFO** | 1+ | Log | Informational patterns |

## Combo Detection

Single findings may not be critical, but combinations are:

| Combo | Rules | Bonus |
|-------|-------|-------|
| `supply-chain-attack` | curl-pipe-bash, wget-pipe-bash, download-execute | +100 |
| `obfuscated-execution` | obfuscated-code + shell-exec + base64-pipe-bash | +80 |
| `credential-theft` | hardcoded-token + env-exfiltration + network-request | +70 |
| `destructive-payload` | rm-rf-root + install-download | +100 |

## Evidence Redaction

Evidence packages never store sensitive code snippets:

```json
{
  "findings": [
    {
      "rule": "hardcoded-token",
      "severity": "HIGH",
      "file": "config.js",
      "line": 42,
      "snippet_redacted": true,
      "snippet_hash": "sha256:a1b2c3d4...",
      "redaction_applied": true
    }
  ]
}
```

- `snippet_redacted: true` — Original code NOT stored
- `snippet_hash` — SHA-256 for verification
- `redaction_applied: true` — Confirms redaction happened

## Example Scan Output

```
📋 SkillGate Scan Results
──────────────────────────────────────────────────
Skills: 5 scanned, 1 skipped (allowlisted)

🔴 malicious-downloader [managed]
   Risk: CRITICAL (score: 220)
   Findings: 6 total (3 CRITICAL, 2 HIGH)
   Evidence: ev-a1b2c3d4

🟠 risky-plugin [workspace]
   Risk: HIGH (score: 85)
   Findings: 4 total (0 CRITICAL, 2 HIGH)
   Evidence: ev-e5f6g7h8

🟡 utility-lib [extraDirs]
   Risk: MEDIUM (score: 35)
   Findings: 3 total (0 CRITICAL, 0 HIGH)
   Evidence: ev-i9j0k1l2

──────────────────────────────────────────────────
Actions Applied:
  ✓ quarantine: malicious-downloader
    Quarantined "malicious-downloader". Changes take effect after restart.
  ✓ disable: risky-plugin
    Disabled "risky-plugin". Changes take effect after restart.

⚠️  Changes take effect in new sessions or after restart.
```

## Config File Location

SkillGate reads/writes `~/.openclaw/openclaw.json`:

```json5
{
  // OpenClaw config (JSON5 with comments supported)
  "skills": {
    "dirs": [
      "/custom/skill/path"
    ],
    "entries": {
      "my-trusted-skill": {
        "enabled": true,
        "_allowlisted": true
      },
      "quarantined-skill": {
        "enabled": false,
        "_quarantine": {
          "timestamp": "2026-02-21T12:00:00Z",
          "reason": "CRITICAL: curl|bash detected",
          "evidenceId": "ev-abc123"
        }
      }
    }
  }
}
```

## Evidence Storage

Evidence packages are stored in `~/.openclaw/evidence/`:

```
~/.openclaw/evidence/
├── ev-a1b2c3d4.json
├── ev-e5f6g7h8.json
└── ev-i9j0k1l2.json
```

Use `/gov explain <skillKey>` to view evidence history.

---

## Release Gate Verification

SkillGate's release workflow includes fail-closed gates to prevent accidental or malicious publishes.

### Gate 1: Tag Format

**Rule**: Only tags matching `v*.*.*` (semantic versioning) trigger releases.

| Tag | Result |
|-----|--------|
| `v0.1.2` | ✅ Workflow triggered |
| `badtag-0.0.0` | ❌ Workflow NOT triggered (tag pattern mismatch) |
| `release-1.0` | ❌ Workflow NOT triggered |

**Verified**: 2026-02-21 — `badtag-0.0.0` was pushed and NO Release workflow ran.

### Gate 2: Commit Must Be on Main

**Rule**: The tagged commit must exist on `origin/main`. Tags on feature branches are rejected.

**Test case**: Created `chore/gate-drill` branch with a new commit, tagged as `v9.9.9`.

**Result**: Workflow failed with:
```
##[error] Tag commit 81ca9b2... is not on origin/main. Refusing to publish.
This prevents accidental releases from feature branches.
```

**Verified**: 2026-02-21 — [Actions run #22258640370](https://github.com/skillgatesecurity/openclaw-skillgate/actions/runs/22258640370) failed as expected.

### Why These Gates Matter

| Attack Vector | Gate | Protection |
|---------------|------|------------|
| Typosquatting tags | Format check | Only `v*.*.*` triggers publish |
| Feature branch leak | Main check | Only `main` commits can be released |
| Compromised dev machine | Both | Attacker must also merge to main |

### Fail-Closed Design

- Gates run BEFORE `npm install` or `npm publish`
- Failure at any gate = workflow exits with error
- No partial publishes possible
