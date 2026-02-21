# ADR-001: NPM OIDC Trusted Publishing

## Status

**Proposed** — Ready for implementation after NPM enables OIDC for this package.

## Context

Currently, npm publishing uses a long-lived `NPM_TOKEN` stored in GitHub Secrets. This creates security risks:

1. **Token exposure** — If leaked, attackers can publish malicious versions
2. **No expiration** — Token remains valid until manually revoked
3. **Broad scope** — Token may have permissions beyond this package

## Decision

Migrate to **npm Trusted Publishing (OIDC)** which:

1. Uses GitHub Actions' OIDC identity — No stored secrets
2. Token is ephemeral — Valid only for the workflow run
3. Scoped to specific repo/workflow — Cannot be reused elsewhere

## Implementation Plan

### Step 1: Configure npm package for Trusted Publishing

1. Go to https://www.npmjs.com/package/@skillgate/openclaw-skillgate/access
2. Under "Publishing access" → "Configure trusted publishing"
3. Add:
   - **Repository**: `skillgatesecurity/openclaw-skillgate`
   - **Workflow**: `release.yml`
   - **Environment**: (optional, can leave blank)

### Step 2: Update release.yml

```yaml
name: Release

on:
  push:
    tags:
      - 'v[0-9]+.[0-9]+.[0-9]+'

jobs:
  release:
    runs-on: ubuntu-latest

    permissions:
      contents: write
      id-token: write  # Required for OIDC

    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Verify tag is on main branch
        run: |
          git fetch origin main --depth=1
          TAG_COMMIT=$(git rev-list -n 1 "$GITHUB_REF_NAME")
          MAIN_HAS=$(git branch -r --contains "$TAG_COMMIT" | grep -c "origin/main" || true)
          if [ "$MAIN_HAS" -eq 0 ]; then
            echo "::error::Tag commit is not on origin/main. Refusing to publish."
            exit 1
          fi

      - name: Use Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20.x'
          registry-url: 'https://registry.npmjs.org'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build
        run: npm run build

      - name: Run tests
        run: npm test

      # OIDC publishing - no NPM_TOKEN needed
      - name: Publish to npm
        run: npm publish --provenance --access public
        # Note: No NODE_AUTH_TOKEN env var needed with OIDC

      - name: Create GitHub Release
        uses: softprops/action-gh-release@v1
        with:
          generate_release_notes: true
```

### Step 3: Delete NPM_TOKEN from GitHub Secrets

After verifying OIDC works:

1. Go to repo Settings → Secrets → Actions
2. Delete `NPM_TOKEN`

## Consequences

### Positive

- **Zero stored secrets** — No token to leak
- **Provenance attestation** — npm shows "Published via GitHub Actions"
- **Audit trail** — Every publish tied to specific workflow run
- **Least privilege** — Token cannot be reused outside workflow

### Negative

- **npm dependency** — Requires npm to support OIDC (currently in beta)
- **Migration risk** — First OIDC publish may fail if misconfigured

## Rollback Plan

If OIDC fails:
1. Re-create `NPM_TOKEN` secret
2. Revert release.yml to use `NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}`

## References

- [npm Trusted Publishing docs](https://docs.npmjs.com/generating-provenance-statements#publishing-packages-with-provenance-via-github-actions)
- [GitHub OIDC for npm](https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/configuring-openid-connect-in-npm)
