---
name: skillgate-gov
description: "Supply-chain governance for OpenClaw skills: scan, assess, quarantine/restore."
metadata: { "openclaw": { "emoji": "🛡️", "requires": { "bins": ["node", "npm"] } } }
---

# SkillGate (Governance)

This skill teaches OpenClaw how to run SkillGate against a skills directory, generate evidence, and quarantine risky skills.

## Install (plugin)
```bash
npm i -g @skillgate/openclaw-skillgate
```

## Quick Start

Once installed as an OpenClaw plugin, use these commands:

```bash
# scan all skills for risks (default: HIGH+)
/gov scan

# scan with all findings including LOW/INFO
/gov scan --all

# quarantine a specific skill
/gov quarantine <skillKey>

# restore a quarantined skill
/gov restore <skillKey>

# explain why a skill was flagged
/gov explain <skillKey>

# show governance status
/gov status
```

## Risk Levels

| Level | Auto Action | Description |
|-------|-------------|-------------|
| CRITICAL | Quarantine | Shell injection, supply-chain attacks |
| HIGH | Disable | Dangerous patterns, external downloads |
| MEDIUM | Warn | Risky but not immediately dangerous |
| LOW/INFO | Log | Informational only |

## Notes

Use this as the standard operating procedure for Skill supply-chain reviews.
