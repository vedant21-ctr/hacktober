# DecisionVault — CI/CD Pipeline Documentation

This document describes the continuous integration and deployment pipelines for DecisionVault.

---

## 1. Pipeline Architecture

The CI pipeline runs via GitHub Actions defined in `.github/workflows/ci.yml`.

### Triggers

- **Pull Requests:** All PRs targeting `main`.
- **Pushes:** All direct commits or merges to `main`.

### Permissions

The pipeline adheres to the principle of least privilege:

```yaml
permissions:
  contents: read
```

Write permissions are not granted to the build job.

---

## 2. Pipeline Stages

```
1. Checkout
   │
2. Node.js LTS (v22) + npm cache
   │
3. npm ci (Clean lockfile installation)
   │
4. Code Formatting (npm run format:check)
   │
5. Linter (npm run lint)
   │
6. TypeScript Typecheck (npm run typecheck)
   │
7. Unit & Integration Tests + Coverage (npm run test:coverage)
   │
8. Security Audit (npm audit --audit-level=critical)
   │
9. Production Build (npm run build)
   │
10. Playwright Browser Install & E2E (npm run test:e2e)
   │
11. Artifact Upload (Coverage & Playwright HTML reports)
```

---

## 3. Hermetic & Offline Guarantee

The CI pipeline is fully self-contained:

- **No Ollama Daemon:** All tests run with `LLM_MODE=replay`.
- **No Gemma Weights Download:** The 4GB model weights are never pulled in CI.
- **No Cloud AI APIs:** Zero OpenAI, Anthropic, or external API calls.
- **No Secrets Required:** The test suite does not require `GITHUB_TOKEN` or cloud credentials.

---

## 4. Security Workflows

In addition to `.github/workflows/ci.yml`, two automated security workflows are active:

1. **CodeQL Analysis (`.github/workflows/codeql.yml`):**
   - Runs static application security testing (SAST) on all PRs and pushes to `main`.
   - Runs weekly scheduled security scans.
2. **Dependabot (`.github/dependabot.yml`):**
   - Automatically monitors npm packages and GitHub Actions for vulnerability alerts and dependency updates weekly.

---

## 5. Troubleshooting CI Failures

| Step Failing                   | Common Cause                                                              | Resolution                                                                                                                          |
| ------------------------------ | ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `Install dependencies`         | `package-lock.json` out of sync with `package.json`                       | Run `npm install` locally and commit the updated `package-lock.json`.                                                               |
| `Check code formatting`        | Unformatted files modified                                                | Run `npm run format` locally and commit.                                                                                            |
| `Verify TypeScript types`      | Missing `@decisionvault/shared` declarations or type errors in server/web | `npm run typecheck` automatically compiles `@decisionvault/shared` first before running `tsc --noEmit` across dependent workspaces. |
| `Run unit & integration tests` | Broken assertion or coverage threshold missed                             | Run `npm run test:coverage` to inspect coverage breakdown.                                                                          |
| `Run Playwright E2E tests`     | Port conflicts or unrendered DOM selectors                                | Run `npm run test:e2e` locally.                                                                                                     |
