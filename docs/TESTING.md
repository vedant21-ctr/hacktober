# DecisionVault — Testing Guide

This document describes the testing architecture, suites, execution procedures, and coverage requirements for DecisionVault.

---

## 1. Testing Philosophy

- **Zero Cloud AI in Tests:** All automated tests run completely offline without Ollama, network dependencies, or API keys.
- **Contract Enforcement:** Every API endpoint and LLM prompt output is verified against canonical Zod schemas and realistic fixtures.
- **Deterministic Replay:** Tests execute in `LLM_MODE=replay` mode.
- **Multi-Level Verification:** Testing spans unit tests, database integrity & FTS5 synchronization tests, input security validation, and Playwright end-to-end (E2E) flows.

---

## 2. Test Suites Overview

| Suite                     | File                      | Focus                                                                                                                                                     |
| ------------------------- | ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Text Normalization**    | `tests/normalize.test.ts` | Unicode NFKC, lowercase, straight quotes, markdown emphasis/backticks/links stripping, control characters, whitespace collapsing, and trimming.           |
| **API & Gemma Contracts** | `tests/contracts.test.ts` | Schema validation for all 23 API JSON fixtures in `shared/fixtures/api/` and Pass A/B Gemma schemas.                                                      |
| **Database & FTS5**       | `tests/database.test.ts`  | Schema initialization, idempotency, enum CHECK constraints, FK cascade deletes, transactions & rollback, and bidirectional FTS5 synchronization triggers. |
| **Server & API Routes**   | `tests/api.test.ts`       | Operational `/api/status` endpoint (HTTP 200), validation of malformed inputs (HTTP 400), and proper `NOT_IMPLEMENTED` (HTTP 501) responses.              |
| **Ollama LLM Interface**  | `tests/ollama.test.ts`    | Replay mode, `ReplayMissError`, `LlmFailure`, and deterministic SHA-256 cache key generation.                                                             |
| **Security & Hardening**  | `tests/security.test.ts`  | Parameterized SQL injection prevention, FTS query safety, path traversal defense, and error leakage prevention.                                           |
| **Frontend States**       | `tests/frontend.test.ts`  | Verification of homepage identity, 404 page rendering, and the `MOCK DATA` banner under `NEXT_PUBLIC_API_MODE=mock`.                                      |
| **Playwright E2E**        | `e2e/app.spec.ts`         | End-to-end flow: backend health check (port 4000), frontend proxy rewrite (port 3000), homepage render, and 404 route rendering.                          |

---

## 3. Running Tests

### Run all Unit and Integration Tests

```bash
npm test
```

### Run Tests with Coverage Enforcement

```bash
npm run test:coverage
```

Coverage thresholds enforced by Vitest:

- **Statements:** 80% (Current: ~97%)
- **Lines:** 80% (Current: ~97%)
- **Functions:** 75% (Current: ~91%)
- **Branches:** 70% (Current: ~86%)

### Run Playwright E2E Tests

```bash
npm run test:e2e
```

_Note: In local development, Playwright automatically spins up the server on port 4000 and Next.js on port 3000._

---

## 4. Replay Mode in Testing

In development and CI, tests operate with `LLM_MODE=replay`:

```bash
LLM_MODE=replay npm test
```

In replay mode:

1. Calls to LLM methods look up cached fixtures by cache key (`sha256(model + promptVersion + systemPrompt + userPrompt + schemaHash)`).
2. Unrecorded queries throw `ReplayMissError` and never make external network calls.
3. In Phase 1/2A, client methods throw `Not implemented` to ensure no live inference occurs during scaffolding.

---

## 5. Troubleshooting Test Failures

- **EACCES port binding on Windows:** On Windows sandboxed environments, ephemeral port binding requires execution permissions. Use `BypassSandbox: true` when executing network socket tests.
- **Coverage threshold failure:** Inspect `coverage/index.html` to identify uncovered lines or branches.
- **E2E timeout:** Ensure ports 4000 and 3000 are not blocked by previous zombie processes before running `npm run test:e2e`.
