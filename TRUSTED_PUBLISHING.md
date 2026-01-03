# Trusted Publishing Setup (Recommended)

**Trusted Publishing** is the modern, secure way to publish to NPM from GitHub Actions. It eliminates the need for NPM tokens entirely by using OpenID Connect (OIDC) authentication.

## Why Trusted Publishing?

**Advantages over tokens:**
- ✅ **No tokens to manage** - Nothing to create, rotate, or secure
- ✅ **No secrets in GitHub** - Nothing that can leak
- ✅ **More secure** - GitHub proves its identity to NPM directly
- ✅ **Scoped automatically** - Only works from your specific repository
- ✅ **NPM recommended** - Official best practice for CI/CD

**How it works:**
```
GitHub Actions → (OIDC) → NPM verifies → Publish allowed
```

## Setup Instructions

### Step 1: Enable Trusted Publishing on NPM

1. **Go to your package settings**
   - Visit: https://www.npmjs.com/package/electron-to-web/access
   - Or: https://www.npmjs.com/settings/YOUR_USERNAME/packages/electron-to-web/access

2. **Configure Trusted Publishing**
   - Scroll to "Publishing Access"
   - Click "Configure Trusted Publishing"
   - Or look for "Automation Tokens" section

3. **Add GitHub Actions as a trusted publisher**
   - Select provider: **GitHub Actions**
   - Repository owner: `lsadehaan`
   - Repository name: `electron-to-web`
   - Workflow filename: `release.yml`
   - Environment (optional): leave empty or use `production`
   - Click "Add"

### Step 2: Update GitHub Actions Workflow

The workflow needs to request an OIDC token and use it for publishing.

**Update `.github/workflows/release.yml`:**

Replace the `publish-npm` job with:

```yaml
publish-npm:
  name: Publish to NPM
  needs: test
  runs-on: ubuntu-latest
  permissions:
    id-token: write  # Required for OIDC
    contents: read

  steps:
  - name: Checkout code
    uses: actions/checkout@v4

  - name: Setup Node.js
    uses: actions/setup-node@v4
    with:
      node-version: '20.x'
      registry-url: 'https://registry.npmjs.org'

  - name: Install dependencies
    run: npm ci

  - name: Build
    run: npm run build

  - name: Publish to NPM (Trusted Publishing)
    run: npm publish --provenance --access public
    env:
      NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}  # Still works as fallback
```

**Key changes:**
- Add `permissions.id-token: write` to enable OIDC
- Use `npm publish --provenance` to publish with OIDC
- The `NODE_AUTH_TOKEN` becomes optional (fallback only)

### Step 3: Remove NPM_TOKEN Secret (Optional)

Once Trusted Publishing is working:

1. Go to: https://github.com/lsadehaan/electron-to-web/settings/secrets/actions
2. Delete the `NPM_TOKEN` secret (if you added one)
3. Trusted Publishing will work without it

## Testing Trusted Publishing

### Test the Setup

1. **Create a test tag:**
   ```bash
   git tag v0.1.0-test
   git push origin v0.1.0-test
   ```

2. **Watch the workflow:**
   - Go to: https://github.com/lsadehaan/electron-to-web/actions
   - The release workflow should run
   - Check for "Publish to NPM" step

3. **Verify on NPM:**
   - Check: https://www.npmjs.com/package/electron-to-web
   - Should show the new version

4. **Clean up test:**
   ```bash
   # Delete test tag
   git tag -d v0.1.0-test
   git push origin :refs/tags/v0.1.0-test

   # Unpublish test version (within 72 hours)
   npm unpublish electron-to-web@0.1.0-test
   ```

## Troubleshooting

### "OIDC token not found"

**Problem:** Workflow doesn't have OIDC permissions

**Solution:** Add `permissions.id-token: write` to the job

```yaml
permissions:
  id-token: write
  contents: read
```

### "Publishing not allowed from this workflow"

**Problem:** NPM trusted publisher configuration doesn't match

**Solution:** Check that NPM settings exactly match:
- Repository: `lsadehaan/electron-to-web`
- Workflow: `release.yml`
- Both must match exactly (case-sensitive)

### "npm ERR! 403 Forbidden"

**Problem:** Trusted Publishing not configured on NPM

**Solution:**
1. Go to package settings on NPM
2. Add GitHub Actions as trusted publisher
3. Verify repository and workflow names

### Workflow file not found

**Problem:** Workflow filename doesn't match NPM config

**Solution:** Use exact filename `.github/workflows/release.yml`

## Advanced: Environment-based Publishing

For extra security, require a GitHub Environment:

**1. Create GitHub Environment:**
- Go to: https://github.com/lsadehaan/electron-to-web/settings/environments
- Create environment: `production`
- Add protection rules:
  - ✅ Required reviewers (optional)
  - ✅ Wait timer (optional)
  - ✅ Deployment branches: Only `main`

**2. Update NPM Trusted Publisher:**
- Environment name: `production`

**3. Update workflow:**
```yaml
publish-npm:
  name: Publish to NPM
  needs: test
  runs-on: ubuntu-latest
  environment: production  # Requires approval
  permissions:
    id-token: write
    contents: read
```

Now releases require approval before publishing!

## Comparison: Tokens vs Trusted Publishing

| Feature | Granular Tokens | Trusted Publishing |
|---------|----------------|-------------------|
| Security | Good | **Excellent** |
| Setup | Medium | Easy |
| Maintenance | Rotate yearly | None |
| Leak risk | Token can leak | Nothing to leak |
| Scope | Package-level | Repo + workflow |
| NPM recommendation | OK | **Recommended** |
| 2FA | Can bypass | Enforced |

## Migration from Tokens

If you already set up a token:

1. **Enable Trusted Publishing** (steps above)
2. **Test that it works** (create test tag)
3. **Remove token from GitHub Secrets**
4. **Revoke token on NPM** (optional)

## Additional Resources

- [NPM Trusted Publishing Docs](https://docs.npmjs.com/generating-provenance-statements)
- [GitHub OIDC Documentation](https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/about-security-hardening-with-openid-connect)
- [NPM Provenance](https://docs.npmjs.com/generating-provenance-statements)

## Summary

**Trusted Publishing is the recommended approach:**
- More secure than tokens
- Easier to maintain
- NPM's official recommendation
- No secrets to manage

**Setup takes ~5 minutes:**
1. Configure on NPM (add GitHub Actions as publisher)
2. Update workflow (add OIDC permissions)
3. Done! No tokens needed.
