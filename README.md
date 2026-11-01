# DecisionVault

> **Open Source Decision Intelligence and Knowledge Recovery**  
> Hacktoberfest 2026 — Problem Statement 06  
> Team: **Glitch** (Vedant Satbhai, Prajjwal Tripathi, Hrishabh Prajapati, Adil Mirza)

---

> [!WARNING]
> **DEVELOPMENT MILESTONE: Phase 1 & Phase 2A (Contract Freeze, Testing Infrastructure & Runnable Scaffolds)**  
> DecisionVault is currently at its Phase 1 / Phase 2A milestone. The data contracts, TypeScript types, Zod schemas, SQLite database structure with FTS5 triggers, Express server scaffold (`/api/status` live; deferred routes returning `501 NOT_IMPLEMENTED`), Next.js UI scaffold, and test suite are frozen and passing. End-to-end ingestion and live extraction pipelines are scheduled for Phase 2 development. In offline/mock mode, the UI runs against frozen contract fixtures.

---

## Table of Contents

1. [Problem Statement 06](#1-problem-statement-06)
2. [Why Undocumented Engineering Decisions Matter](#2-why-undocumented-engineering-decisions-matter)
3. [What DecisionVault Does](#3-what-decisionvault-does)
4. [How It Ingests Historical GitHub Discussions](#4-how-it-ingests-historical-github-discussions)
5. [How Accepted & Rejected Alternatives Are Recovered](#5-how-accepted--rejected-alternatives-are-recovered)
6. [How Original Evidence Is Verified (Evidence Lock)](#6-how-original-evidence-is-verified-evidence-lock)
7. [How Decisions Connect to Source Code](#7-how-decisions-connect-to-source-code)
8. [How Developers Receive Prior-Decision Warnings](#8-how-developers-receive-prior-decision-warnings)
9. [Technology Stack & Local Gemma Runtime](#9-technology-stack--local-gemma-runtime)
10. [Installation & Execution Guide](#10-installation--execution-guide)
11. [Project Documentation & Architecture Links](#11-project-documentation--architecture-links)
12. [Monorepo Layout](#12-monorepo-layout)
13. [License & Disclosures](#13-license--disclosures)

---

## 1. Problem Statement 06

**"Recover the engineering decisions nobody wrote down."**

Large-scale open-source and enterprise codebases evolve across thousands of issues, pull requests, and forum threads. While the final code is committed to Git, the architectural deliberations, trade-offs evaluated, rejected designs, and operational constraints that shaped the code remain scattered across ephemeral discussion threads.

---

## 2. Why Undocumented Engineering Decisions Matter

When engineering decisions are not formalized or are lost in discussion archives, teams suffer from acute, compounding inefficiencies:

- **Maintainer Burnout and Relitigation:** New contributors continually open proposals or pull requests advocating designs that maintainers debated and rejected years ago. Maintainers must repeatedly re-explain the same technical reasons.
- **Lost Architectural Rationale:** Months or years after a design is implemented, original authors depart and new engineers cannot answer: _Why was this library selected? Why was this synchronous queue preferred over an event bus? Why was this specific constraint imposed?_
- **Accidental Regressions During Refactoring:** Developers modifying or modernizing code inadvertently eliminate safeguards or reintroduce architectural bottlenecks because the original constraint was documented only in an old closed issue.
- **Wasted Contributor Effort:** Well-meaning developers spend days writing elaborate code for proposals that were destined for rejection due to unwritten operational or compatibility constraints.

---

## 3. What DecisionVault Does

DecisionVault serves as an **automated decision intelligence ledger**:

1. **Recovers Technical Decisions:** Automatically reconstructs structured architectural decisions, separating accepted solutions from rejected alternatives.
2. **Guarantees Traceability via Evidence Lock:** Verifies every extracted claim against source text using deterministic character-level verification (`match_score = 1.0` or `fuzzy >= 0.90`), rejecting unsubstantiated assertions.
3. **Connects Decisions to Code:** Establishes bidirectional links between decisions and repository files, tracking historical file renames across Git history to HEAD.
4. **Warns Against Repeating Past Mistakes:** Evaluates incoming pull requests and proposals via the **Prior Art Report** to surface prior rejections before code is merged.
5. **Monitors Changing Constraints with Reopen Radar:** Uses deterministic probes (e.g. Python runtime, Node engines, dependencies) to alert maintainers when an old rejection reason no longer applies.
6. **Preserves 100% Privacy:** Runs exclusively with a local open-weights model (**Gemma 4 E4B** via Ollama) with zero cloud AI dependencies.

---

## 4. How It Ingests Historical GitHub Discussions

The ingestion subsystem treats all remote data as untrusted input and prepares it for deterministic extraction:

- **Multi-Source Adapters:** Supports GitHub REST APIs (issues, pull requests, issue comments, review comments), Discourse JSON endpoints (`discuss.python.org`), and local offline JSON thread dumps.
- **Offline Raw Cache:** Raw HTTP responses are immutably archived in the `raw_responses` SQLite table. Reprocessing, re-chunking, and prompt adjustments execute locally without re-contacting remote APIs or consuming rate limits.
- **Text Normalization (`normalizeText`):** Text is standardized via Unicode NFKC, converted to lowercase, stripped of Markdown formatting and control characters, and normalized with straight quotes. This ensures consistent string offsets for verification.
- **Thread-Local Identification (`c1`..`cN`):** Comments are numbered locally within thread windows. Gemma never sees or produces internal database primary keys or raw URLs, eliminating fabricated identifier hallucinations.
- **Deterministic Prefiltering:** Automatically prioritizes candidate threads with high decision relevance (e.g., terms such as `rejected`, `decided`, `alternative`, `WONTFIX`) while capping imports to maintain responsive local inference.

---

## 5. How Accepted & Rejected Alternatives Are Recovered

Rather than relying on a single monolithic prompt, DecisionVault uses a two-pass extraction pipeline:

```text
Thread Comments ──► Window Chunker ──► Pass A: Comment Labeling ──► Filter ──► Pass B: Structured Extraction
                                      (proposal, objection, noise)             (decisions, alts, conditions)
```

1. **Pass A — Comment Classification (Per Window):**
   - Ingests overlapping chunks of 15–25 comments.
   - Categorizes each comment: `proposal`, `objection`, `support`, `decision`, `rejection`, `clarification`, or `noise`.
2. **Pass B — Structured Decision Synthesis (Per Thread):**
   - Gathers labeled comments and generates a validated JSON payload adhering to the schema:
     - **Title & Summary:** Crisp distillation of the technical debate.
     - **Status:** `accepted`, `rejected`, or `unresolved`.
     - **Alternatives:** Discrete designs discussed, categorized as `chosen`, `rejected`, or `open`.
     - **Rejection Reasons:** Categorized by reason (`compatibility`, `performance`, `security`, `maintenance`, `complexity`, `policy`, `infrastructure`, etc.).
     - **Conditions:** Explicit technical prerequisites or environment constraints linked to deterministic probes.
     - **Events:** Chronological progression of debate milestones (`proposed`, `objected`, `agreed`, `decided`, `revised`).

---

## 6. How Original Evidence Is Verified (Evidence Lock)

To eliminate LLM hallucination and ensure auditability, DecisionVault implements the **Evidence Lock**—a 100% deterministic verification module:

- **Strict Verbatim Verification:** For every quote emitted by Gemma, the backend retrieves `comments.body_norm` for the cited thread comment:
  - **Method 1 (`normalized_exact`):** Substring match on normalized text with quote length $\ge 20$ characters. Yields `match_score = 1.0`.
  - **Method 2 (`fuzzy` fallback):** Sliding-window Levenshtein similarity metric. Quotes with a score $\ge 0.90$ are accepted and flagged as _Approximate_.
  - **Method 3 (`none` / Unverified):** Quotes scoring below 0.90 or referencing invalid comments are recorded as `verified = 0`. They remain visible in the UI with an _Unverified Claim_ badge and receive zero weight in confidence scoring.
- **Mathematical Confidence Scoring:** Decision confidence is computed algorithmically by the backend—never self-reported by the LLM:
  $$\text{Confidence} = 0.4 \times \text{Coverage} + 0.4 \times \text{AuthorRole} + 0.2 \times \text{ReasonCoverage}$$
  - $\text{Coverage}$: Ratio of verified evidence quotes over total claimed quotes (fuzzy weighted at 0.5, exact at 1.0).
  - $\text{AuthorRole}$: 1.0 if decision statement is verified by a repository owner, member, or collaborator; 0.6 if by a contributor; 0.0 if unverified.
  - $\text{ReasonCoverage}$: Percentage of rejected alternatives backed by verified rejection reasons.
- Decisions lacking verified evidence statements are automatically demoted to `unresolved`.

---

## 7. How Decisions Connect to Source Code

DecisionVault links abstract discussions to physical files in the repository using a deterministic hierarchy:

1. **`mentioned`:** Scans verified quotes and discussion comments for file paths matching real files in the repository tree.
2. **`pr_diff`:** Extracts changed files and diff patches directly from merged pull requests, linking decisions to the exact commits that introduced the change.
3. **`rename_tracked` (Git History Tracking):** Executes a single-pass Git rename resolution (`git log --name-status -M --diff-filter=R`). When a historical file is renamed or relocated, DecisionVault maps the historical path to its `current_path` at HEAD.
4. **`symbol` (Stretch):** Identifies backticked code identifiers matched via `git grep` against repository HEAD.

Developers can navigate the repository tree in the **Code Map** or query the backend via `GET /api/code/why?path=...` to inspect all architectural decisions that govern a specific file.

---

## 8. How Developers Receive Prior-Decision Warnings

DecisionVault prevents teams from repeating historical missteps through two active feedback mechanisms:

### A. Prior Art Reports (Proposal Sandbox)

Before writing code or opening a PR, developers input an idea description, pull request number, or diff:

1. The backend extracts changed paths and key technical concepts.
2. SQLite FTS5 retrieves matching historical decisions and verified evidence.
3. Gemma evaluates the candidate set, categorizing each item as `conflicts`, `related`, or `irrelevant`.
4. A structured **Prior Art Report** is generated, displaying prior rejections, verbatim maintenance quotes, and `reconsiderIf` guidance.

### B. Reopen Radar (Constraint Monitoring)

Many alternatives are rejected due to temporary constraints (e.g., _"Cannot adopt dataclasses because we must support Python 2.7"_). The **Reopen Radar** continually monitors these constraints against HEAD:

- **Deterministic Probes:** Probes inspect `pyproject.toml` (`python_requires`), `package.json` (`node_engines`), dependency manifests (`dependency_present`), and CI workflows (`ci_python_matrix`).
- **Health Signal:** If a historical blocking constraint has changed, the condition is flagged as `may_not_hold`.
- **Maintainer Alert:** Maintainers receive an actionable notice: _"This historical rejection may deserve reconsideration because the original constraint appears to have changed."_

---

## 9. Technology Stack & Local Gemma Runtime

| Layer                     | Technology                                    | Details                                                                         |
| :------------------------ | :-------------------------------------------- | :------------------------------------------------------------------------------ |
| **Frontend**              | Next.js 14+ (App Router), React, Tailwind CSS | Port 3000, dark-mode developer UI, responsive design                            |
| **Backend API**           | Node.js, Express, TypeScript, Zod             | Port 4000, input-hardened REST API, strict schemas                              |
| **Database & Search**     | SQLite3 (`better-sqlite3`) + FTS5             | Full-text search with `porter unicode61` tokenizer and automated triggers       |
| **AI Inference**          | Google Gemma 4 E4B (`gemma4:e4b`)             | Executed locally via Ollama (`http://localhost:11434`), zero cloud transmission |
| **Verification**          | Deterministic Evidence Lock                   | Substring + sliding-window Levenshtein matching                                 |
| **Testing**               | Vitest                                        | Contract verification, schema validation, database integrity, replay tests      |
| **Assistance Disclosure** | Gemini 3.8 High / Argon                       | Used strictly as interactive pair-programming assistant during development      |

---

## 10. Installation & Execution Guide

### Prerequisites

- **Node.js:** v20.x or higher (tested on Node v22 and v24)
- **npm:** v10.x or higher
- **Ollama:** (Required for live AI extraction in Phase 2; optional in Phase 1 replay mode)
  - Install Ollama from [ollama.ai](https://ollama.ai)
  - Pull the model: `ollama pull gemma4:e4b`

### Installation Steps

```bash
# 1. Clone the repository
git clone https://github.com/vedant21-ctr/hacktober.git
cd hacktober

# 2. Install workspace dependencies
npm ci

# 3. Build shared contract library
npm run build --workspace=@decisionvault/shared

# 4. Configure environment variables
cp .env.example .env
```

### Running the Application

```bash
# Start backend (port 4000) and frontend (port 3000) concurrently
npm run dev

# Or start services individually:
npm run dev --workspace=@decisionvault/server  # Express backend on http://localhost:4000
npm run dev --workspace=@decisionvault/web     # Next.js frontend on http://localhost:3000
```

### Running Verification & Tests

```bash
# Run unit, contract, and database tests
npm test

# Run TypeScript typechecks across all workspaces
npm run typecheck

# Run linter
npm run lint

# Build all packages and applications for production
npm run build
```

---

## 11. Project Documentation & Architecture Links

Detailed technical documents, testing procedures, and presentation materials:

- 📐 [**Authoritative Architecture (v3)**](./DecisionVault_Architecture_v3.md) — Comprehensive technical blueprint, database schema, and pipeline design.
- 📊 [**Architecture Diagrams**](./docs/ARCHITECTURE_DIAGRAMS.md) — Visual Mermaid diagrams of all five core pipelines.
- 🎮 [**Demo Walkthrough Guide**](./docs/DEMO.md) — Step-by-step evaluator instructions, feature walkthrough, and Phase 2 status.
- 🎤 [**Eight-Minute Pitch & Speaker Notes**](./docs/PITCH.md) — Complete timed hackathon pitch script and slide breakdowns.
- 📋 [**Hackathon Evaluation Checklist**](./docs/EVALUATION_CHECKLIST.md) — Rubric mapping against Problem Statement 06 criteria.
- 🛡️ [**Security & Threat Model**](./docs/SECURITY.md) — Security posture, input sanitization, and read-only boundary guarantees.
- 🧪 [**Testing Strategy**](./docs/TESTING.md) — Vitest test suites, contract assertions, and fixture replay modes.
- 📜 [**Contract Decisions Register**](./docs/CONTRACT_DECISIONS.md) — Architectural resolutions recorded during the Phase 1 freeze.

---

## 12. Monorepo Layout

```text
DecisionVault/
├── HACKATHON.md                    # Hackathon registration and team details
├── README.md                       # Main product guide and instructions
├── LICENSE                         # MIT License
├── DecisionVault_Architecture_v3.md# Authoritative product and system specification
├── package.json                    # Monorepo root package configuration
├── package-lock.json               # Locked dependency tree
├── tsconfig.base.json              # Shared TypeScript base configuration
├── .github/
│   ├── pull_request_template.md    # PR template with AI disclosures
│   └── workflows/ci.yml            # CI workflow for lint, test, typecheck, build
├── shared/                         # Frozen contracts, enums, schemas, and fixtures
│   ├── CONTRACT_VERSION            # Contract version indicator (1)
│   ├── enums.ts                    # Canonical system enums
│   ├── api.ts                      # Zod schemas and TypeScript types for all endpoints
│   ├── gemma.ts                    # Pass A & Pass B extraction schemas
│   ├── normalize.ts                # Deterministic text normalization
│   └── fixtures/api/               # Realistic JSON contract fixtures
├── server/                         # Express backend and database layer
│   ├── index.ts                    # Server entrypoint and route handlers
│   ├── db/                         # SQLite schema and connection helpers
│   └── llm/                        # Ollama client interface and cache key generator
├── apps/web/                       # Next.js web application
│   ├── app/                        # App Router pages and layout
│   └── components/                 # UI components and API status indicators
├── docs/                           # Architecture, demo, pitch, and security docs
│   ├── ARCHITECTURE_DIAGRAMS.md    # 5 Mermaid pipeline flowcharts
│   ├── DEMO.md                     # Comprehensive demo execution guide
│   ├── PITCH.md                    # 8-minute timed presentation script
│   ├── EVALUATION_CHECKLIST.md     # Rubric compliance checklist
│   ├── SECURITY.md                 # Threat model and input defenses
│   └── CONTRACT_DECISIONS.md       # Phase 1 architectural resolutions
└── tests/                          # Vitest contract, schema, and database suites
```

---

## 13. License & Disclosures

- **License:** Open source under the [MIT License](./LICENSE). Copyright (c) 2026 Vedant Satbhai.
- **Product AI Runtime:** Google Gemma 4 E4B (`gemma4:e4b`) executed locally via Ollama. No third-party AI APIs or cloud models are used.
- **Development Assistant Disclosure:** Gemini 3.8 High / Argon via Google Antigravity was used strictly as an interactive coding assistant during development. It does not run as an application dependency.
