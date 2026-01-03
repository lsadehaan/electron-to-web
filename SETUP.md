# CI/CD Setup Guide

This guide walks you through setting up automated testing, releases, and branch protection for electron-to-web.

## Prerequisites

- GitHub repository with code pushed
- NPM account (for publishing packages)
- Repository admin access (for branch protection)

## 1. NPM Token Setup

To publish packages to NPM automatically, you need to create an NPM access token.

### Create NPM Token

1. **Login to NPM**
   ```bash
   npm login
   ```

2. **Generate an access token**
   - Go to https://www.npmjs.com/settings/YOUR_USERNAME/tokens
   - Click "Generate New Token"
   - Select "Automation" token type
   - Copy the token (starts with `npm_...`)

3. **Add token to GitHub Secrets**
   - Go to your GitHub repository
   - Navigate to: **Settings → Secrets and variables → Actions**
   - Click "New repository secret"
   - Name: `NPM_TOKEN`
   - Value: Paste your NPM token
   - Click "Add secret"

### Verify Token

The token will be used automatically by the release workflow when you create a tag.

## 2. Branch Protection Setup

Protect the main branch to ensure all changes go through CI/CD.

### Enable Branch Protection

1. **Navigate to branch settings**
   - Go to your GitHub repository
   - Click **Settings → Branches**
   - Under "Branch protection rules", click "Add rule"

2. **Configure protection rules**

   **Branch name pattern:** `main`

   **Protect matching branches:**

   ✅ **Require a pull request before merging**
   - Require approvals: 1
   - Dismiss stale pull request approvals when new commits are pushed
   - Require review from Code Owners (optional)

   ✅ **Require status checks to pass before merging**
   - Require branches to be up to date before merging
   - Status checks that are required:
     - `test (18.x)`
     - `test (20.x)`
     - `test (22.x)`
     - `lint`

   ✅ **Require conversation resolution before merging**

   ✅ **Require signed commits** (optional but recommended)

   ✅ **Require linear history** (optional)

   ✅ **Do not allow bypassing the above settings**
   - Include administrators

   ❌ **Allow force pushes** (keep disabled)

   ❌ **Allow deletions** (keep disabled)

3. **Save changes**
   - Click "Create" or "Save changes"

### What This Protects Against

- Direct pushes to main (all changes via PR)
- Merging failing tests
- Merging without code review
- Accidental force pushes or deletions

## 3. CI/CD Workflows

Three automated workflows are configured:

### CI Workflow (`.github/workflows/ci.yml`)

**Triggers:** Every push and pull request to `main`

**What it does:**
- Runs tests on Node.js 18, 20, and 22
- Performs TypeScript type checking
- Uploads test reports as artifacts
- Comments test results on PRs

**Status:** Visible as badges in README

### Release Workflow (`.github/workflows/release.yml`)

**Triggers:** When you push a version tag (e.g., `v0.1.0`)

**What it does:**
- Runs full test suite
- Publishes to NPM (if tests pass)
- Creates GitHub release
- Attaches test report to release

**How to trigger:**
```bash
# Update version in package.json
npm version patch  # or minor, or major

# Update CHANGELOG.md with release notes

# Push tag to trigger release
git push origin main --tags
```

## 4. Making Your First Release

Follow these steps for the initial release:

### Step 1: Verify CI is Green

Check that all tests pass: https://github.com/lsadehaan/electron-to-web/actions

### Step 2: Update Version

```bash
# For the first release (already at 0.1.0)
npm version 0.1.0

# For subsequent releases
npm version patch  # 0.1.0 -> 0.1.1
npm version minor  # 0.1.0 -> 0.2.0
npm version major  # 0.1.0 -> 1.0.0
```

### Step 3: Update CHANGELOG.md

Move items from `[Unreleased]` to the new version section:

```markdown
## [0.1.0] - 2026-01-03

### Added
- Initial release
- Full IPC support
...
```

### Step 4: Commit and Tag

```bash
git add package.json CHANGELOG.md
git commit -m "chore: release v0.1.0"
git tag v0.1.0
```

### Step 5: Push

```bash
git push origin main --tags
```

### Step 6: Monitor Release

1. Watch GitHub Actions: https://github.com/lsadehaan/electron-to-web/actions
2. Verify NPM publish: https://www.npmjs.com/package/electron-to-web
3. Check GitHub release: https://github.com/lsadehaan/electron-to-web/releases

## 5. Status Badges

Badges are already added to README.md:

```markdown
[![CI](https://github.com/lsadehaan/electron-to-web/actions/workflows/ci.yml/badge.svg)](...)
[![npm version](https://img.shields.io/npm/v/electron-to-web.svg)](...)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](...)
[![Node.js Version](https://img.shields.io/node/v/electron-to-web)](...)
```

These will automatically update when:
- CI runs (shows passing/failing)
- New version is published to NPM
- Node.js version requirements change

## 6. Troubleshooting

### CI Fails with "npm ERR! 404 Not Found"

Express is a peer dependency. The CI workflow installs it separately:
```yaml
- name: Install express (peer dependency)
  run: npm install express
```

### NPM Publish Fails with "403 Forbidden"

- Check that NPM_TOKEN is set correctly in GitHub Secrets
- Verify token has "Automation" permissions
- Check that package name is available on NPM

### Branch Protection Prevents Merging

- Ensure all required status checks pass
- Get required approvals
- Resolve all conversations
- Update branch if behind main

### Release Workflow Doesn't Trigger

- Verify tag matches pattern `v*.*.*`
- Push tag: `git push origin v0.1.0`
- Check Actions tab for workflow run

## 7. Post-Setup Checklist

- ✅ NPM token added to GitHub Secrets
- ✅ Branch protection enabled on `main`
- ✅ CI workflow runs on every PR
- ✅ Status badges visible in README
- ✅ Ready to make first release

## 8. Next Steps

1. **Make your first release** (see Step 4 above)
2. **Enable Discussions** on GitHub for community support
3. **Add GitHub topics** to help discovery:
   - electron
   - web
   - ipc
   - json-rpc
   - websocket
   - migration

4. **Consider adding:**
   - Dependabot for dependency updates
   - CodeQL for security scanning
   - Codecov for test coverage tracking
   - Semantic release for automated versioning

## Need Help?

- GitHub Actions docs: https://docs.github.com/en/actions
- NPM publishing: https://docs.npmjs.com/packages-and-modules/contributing-packages-to-the-registry
- Branch protection: https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/defining-the-mergeability-of-pull-requests/about-protected-branches
