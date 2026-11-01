# DecisionVault — Hackathon Evaluation Checklist

> **Hacktoberfest 2026:** Problem Statement 06 — Open Source Decision Intelligence and Knowledge Recovery  
> **Team:** Glitch (Vedant Satbhai, Prajjwal Tripathi, Hrishabh Prajapati, Adil Mirza)  
> **Repository:** [https://github.com/vedant21-ctr/hacktober](https://github.com/vedant21-ctr/hacktober)  
> **License:** MIT License

---

This document provides a transparent, auditable compliance checklist mapped against the judging criteria, technical constraints, and operational requirements of Hacktoberfest 2026 Problem Statement 06.

---

## 1. Problem Statement 06 Alignment

| Problem Statement 06 Requirement | Implementation in DecisionVault | Alignment Status |
| :--- | :--- | :--- |
| **Analyze public discussions, issues, and PRs** | Multi-source ingestion architecture supporting GitHub REST API, Discourse JSON endpoints (`discuss.python.org`), and offline JSON discussion dumps. | ✅ **Compliant** (Schema & contracts complete; live adapter in Phase 2) |
| **Extract engineering decisions and reasoning** | Two-pass Gemma extraction pipeline: Pass A classifies comments (`proposal`, `objection`, etc.); Pass B synthesizes structured decisions. | ✅ **Compliant** (Prompts and schemas frozen in `shared/gemma.ts`) |
| **Identify accepted and rejected alternatives** | Normalized `alternatives` relational table capturing `chosen`, `rejected`, and `open` outcomes with `reason_category` categorization. | ✅ **Compliant** (Implemented in SQLite schema and API contracts) |
| **Maintain references to original discussions** | **Evidence Lock:** Quotes verified against source text with substring offsets (`normalized_exact`) or Levenshtein matching (`fuzzy`). | ✅ **Compliant** (Deterministic design, unit tests passing) |
| **Link decisions to source code** | Deterministic hierarchy (`mentioned`, `pr_diff`, `rename_tracked`) mapping decisions to files and tracking Git renames to HEAD. | ✅ **Compliant** (Schema tables `decision_files` and `code/tree` API) |
| **Surface warnings on PRs modifying code** | **Prior Art Reports** and **Proposal Sandbox** classify proposals as `conflicts`, `related`, or `irrelevant`. | ✅ **Compliant** (Contract schemas frozen, fixtures verified) |
| **Evaluate against historical PEP discussions** | Blind Recovery Benchmark comparing extracted rejected alternatives against curated PEP gold cases. | ✅ **Compliant** (Benchmark schema, metrics, and gold formats established) |

---

## 2. Open-Source Model Disclosure

DecisionVault strictly honors the open-source model guidelines of the hackathon:

- **AI Model Name:** Google **Gemma 4 E4B**
- **Ollama Identifier:** `gemma4:e4b`
- **Execution Location:** 100% local on user development machines.
- **Provider & Model Weights:** Google open-weights model distributed via Ollama.
- **No Cloud AI APIs:** Zero external cloud AI SDKs (no OpenAI, no Anthropic, no cloud endpoints).
- **No Third-Party Embeddings:** Vector retrieval is intentionally avoided in favor of deterministic SQLite FTS5 (`porter unicode61`) and deterministic Git code links.
- **Coding Assistant Disclosure:** Gemini 3.8 High / Argon (Google Antigravity) was used strictly as an interactive coding pair-programmer during repository construction. It is not bundled as an inference runtime or application dependency.

---

## 3. Local Gemma 4 E4B Runtime Verification

| Runtime Criterion | Verification Details | Status |
| :--- | :--- | :--- |
| **Ollama Connectivity** | Backend `GET /api/status` queries `http://localhost:11434/api/tags` and reports reachable status. | ✅ **Operational** |
| **Cache Key Determinism** | Cache keys are deterministic SHA-256 hashes of `(model + promptVersion + systemPrompt + userPrompt + schemaHash)`. | ✅ **Verified by Unit Tests** |
| **Zero Network Replay Mode** | `server/llm/ollama.ts` supports `LLM_MODE=replay` for CI and offline execution; misses throw `ReplayMissError` without making network calls. | ✅ **Verified in CI** |
| **Prompt Injection Defenses** | Comments are treated strictly as untrusted data; delimited system prompts instruct Gemma to ignore embedded instructions. | ✅ **Designed & Documented** |

---

## 4. Test & CI Evidence

Continuous Integration is enforced on every commit and pull request via `.github/workflows/ci.yml`:

- **Automated Test Suite:** Vitest executes across all workspace packages (`@decisionvault/shared`, `@decisionvault/server`, `@decisionvault/web`, `@decisionvault/tests`).
- **Contract Verification:** Tests validate that all API route fixtures in `shared/fixtures/api/*.json` strictly adhere to the frozen Zod schemas in `shared/api.ts`.
- **Database Schema Integrity:** Automated tests verify SQLite foreign key enforcement, enum CHECK constraints, and FTS5 synchronization triggers.
- **Deterministic Text Normalization:** Comprehensive test suite validates Unicode NFKC normalization, markdown stripping, straight quotes conversion, and whitespace collapsing.
- **Static Type Checking:** `npm run typecheck` runs `tsc --noEmit` across all packages without type errors.
- **Code Quality & Linting:** `npm run lint` enforces clean ESLint and Prettier rules across the monorepo.

---

## 5. Real Examples & Reproducibility

To ensure evaluations are fully reproducible without network flakiness:

1. **Pre-recorded Fixtures:** Complete, realistic contract fixtures exist for every API endpoint under `shared/fixtures/api/`:
   - `overview.json`
   - `decisions.json`
   - `decision-detail.json`
   - `ask.json`
   - `sandbox-report.json`
   - `radar.json`
   - `timeline.json`
   - `code-why.json`
2. **Deterministic Seed & Temperature:** Gemma inference runs with `temperature = 0` and `seed = 42` to maximize reproducibility across runs.
3. **Traceable Git Commits:** Every change follows the repository commit standards and references authoritative sections from `DecisionVault_Architecture_v3.md`.

---

## 6. Security and Secret Checks

DecisionVault maintains a secure, read-only operational perimeter:

- **Zero Secret Commits:** No API tokens, passwords, or credentials exist in git history. Server environment variables are loaded via `.env` (excluded by `.gitignore`).
- **Read-Only Ingestion:** DecisionVault never creates commits, opens issues, or writes comments to remote repositories.
- **Zero Code Execution:** The system parses repository text, commit diffs, and manifests. It never compiles or executes untrusted code from repositories.
- **SQL Injection Defenses:** Parameterized SQLite queries throughout; FTS5 search queries sanitize user input by quoting search tokens to prevent syntax injection.
- **Path Traversal Guards:** File adapters reject paths containing `..` or leading slashes outside the designated repository directory.
- **Automated Security Scanning:** Dependabot and CodeQL static application security testing enabled in `.github/`.

---

## 7. PR Workflow & Team Contributions

Development adheres to a disciplined multi-developer workflow:

- **Isolated Branches:** Workstreams develop on designated feature branches (`feat/contract-freeze`, `feat/decisionvault-frontend`, `feat/demo-documentation`).
- **Standardized PR Template:** Every pull request requires completion of `.github/pull_request_template.md`, documenting:
  - Models used.
  - Coding assistants used.
  - Test evidence and command output.
  - Architecture specification references.
- **Change Control Policy:** Any modification to shared schemas or database tables requires a unanimous review and contract version bump.

---

## 8. Live Demo Readiness

| Readiness Item | Validation Procedure | Status |
| :--- | :--- | :--- |
| **Local Dev Server** | `npm run dev` starts both server (port 4000) and web (port 3000) concurrently. | ✅ **Ready** |
| **API Status Check** | `curl -s http://localhost:4000/api/status` returns `{ ok: true, db: true }`. | ✅ **Ready** |
| **Frontend UI Scaffold** | Browser navigation to `http://localhost:3000` loads styled dark-mode interface. | ✅ **Ready** |
| **Mock Data Banner** | Setting `NEXT_PUBLIC_API_MODE=mock` activates the prominent mock data disclosure banner. | ✅ **Ready** |
| **Demo Script** | `docs/DEMO.md` provides complete click-by-click instructions for judges. | ✅ **Ready** |
| **Pitch Presentation** | `docs/PITCH.md` provides an 8-minute timed presentation with speaker notes. | ✅ **Ready** |

---

## 9. Known Limitations

In the interest of rigorous engineering honesty, the following constraints and limitations are documented:

1. **Phase 1 / Phase 2 Milestone Division:**  
   The current repository represents the completion of Phase 1 and Phase 2A (Contract freeze, schema design, FTS5 triggers, Express API scaffold, Next.js UI scaffold, and test suite). End-to-end live ingestion from remote GitHub APIs and live two-pass extraction are scheduled for Phase 2 development.
2. **Local Gemma Inference Throughput:**  
   Running Gemma 4 E4B locally on consumer hardware processes approximately 10–25 tokens/second depending on CPU/GPU architecture. To maintain a responsive user experience, discussion imports are prefiltered and capped (default 30–50 threads).
3. **PEP Historical Training Exposure:**  
   Because Gemma 4 E4B was pre-trained on open web data, it may have encountered famous Python PEP texts during training. While DecisionVault feeds only raw discussion text and never the PEP itself into extraction, benchmark evaluations on recent, non-PEP discussions provide the truest measure of extraction performance.
4. **Git History Depth on Large Monorepos:**  
   Tracing full rename histories across repos with >100,000 commits can be computationally intensive. In production, Git rename tracking is bounded by commit date or target directory scope.
