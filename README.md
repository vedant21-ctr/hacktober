# DecisionVault

> **Open Source Decision Intelligence and Knowledge Recovery**  
> Hacktoberfest 2026 — Problem Statement 06  
> Team: Glitch (Vedant Satbhai, Prajjwal Tripathi, Hrishabh Prajapati, Adil Mirza)

---

> [!WARNING]
> **WORK IN PROGRESS (Phase 1 & Phase 2A: Contract Freeze, Testing & CI/CD Infrastructure)**  
> DecisionVault is currently in early scaffolding. The contracts, schemas, database structure, and test suite are frozen and verified. Ingestion, extraction, and verification pipelines belong to subsequent phases and are **not yet operational**. Do not assume end-to-end functionality is live.

---

## Overview

Open-source projects frequently lose the reasoning behind everyday architectural and design decisions. Maintainers re-litigate old debates, and contributors repeatedly propose alternatives that were previously rejected.

**DecisionVault** is designed to:

- Recover decisions from public issues, pull requests, and forum discussions.
- Lock every extracted claim to verbatim verified quotes in source discussions (**Evidence Lock**).
- Index decisions and alternatives with SQLite FTS5.
- Warn developers before they repeat rejected ideas via **Prior Art Reports** and **Reopen Radar**.
- Run 100% locally using Google's **Gemma 4 E4B** (`gemma4:e4b`) through Ollama.

## Technical Architecture

The technical specification is defined in [`DecisionVault_Architecture_v3.md`](./DecisionVault_Architecture_v3.md).

### AI Boundary

- **Only Model:** `gemma4:e4b` via local Ollama (`http://localhost:11434`).
- **No Cloud AI:** Zero OpenAI/Anthropic SDKs or third-party cloud AI APIs.
- **No Embeddings:** Retrieval is powered by deterministic SQLite FTS5 search and deterministic code links.
- **Coding Assistants:** Claude Code and Antigravity Pro are used solely as development assistants.

## Current Implementation Status (Phase 1)

| Area                       | Status       | Notes                                                                                         |
| -------------------------- | ------------ | --------------------------------------------------------------------------------------------- |
| Contract Freeze            | **Done**     | `shared/CONTRACT_VERSION` = 1, shared types & Zod schemas frozen                              |
| SQLite Schema & FTS5       | **Done**     | Full schema in `server/db/schema.sql` with FTS5 synchronization triggers                      |
| API Fixtures               | **Done**     | Realistic JSON fixtures for every endpoint in `shared/fixtures/api/`                          |
| Express Server             | **Done**     | Scaffold running on port 4000; `/api/status` operational; other routes return 501             |
| Next.js Scaffold           | **Done**     | App Router with Tailwind CSS on port 3000; `/api/*` rewrites to port 4000; `MOCK DATA` banner |
| Ollama Interface           | **Done**     | Types, cache key generator (`sha256`), and interfaces in `server/llm/ollama.ts`               |
| Pipelines (Ingest/Extract) | **Deferred** | Phase 2 implementation scope                                                                  |

## Prerequisites

- **Node.js:** v20+ (tested on Node v22 / v24)
- **npm:** v10+
- **Ollama:** (Optional for Phase 1; required in Phase 2 for live inference with `gemma4:e4b`)

## Installation

```bash
# Clone the repository
git clone https://github.com/vedant21-ctr/hacktober.git
cd hacktober

# Install dependencies (respecting npm workspaces)
npm ci
```

## Development Commands

```bash
# Start both backend (port 4000) and frontend (port 3000) concurrently
npm run dev

# Run all unit and contract tests
npm test

# Run TypeScript typechecks across all workspaces
npm run typecheck

# Run linter
npm run lint

# Build all workspaces
npm run build
```

## Environment Variables

Copy `.env.example` to `.env` to customize settings:

```bash
cp .env.example .env
```

Key variables:

- `PORT`: Express server port (default: `4000`)
- `DB_PATH`: SQLite database file path (default: `:memory:` in tests, `./decisionvault.db` in dev)
- `LLM_MODE`: `replay` (default in tests), `record`, or `live`
- `NEXT_PUBLIC_API_MODE`: Set to `mock` to display the offline contract banner in the web interface

## Monorepo Layout

```text
DecisionVault/
├── HACKATHON.md                    # Hackathon details and AI disclosures
├── README.md                       # Project overview and instructions
├── LICENSE                         # MIT License
├── DecisionVault_Architecture_v3.md# Authoritative product and technical specification
├── package.json                    # Monorepo root package.json
├── package-lock.json               # Locked dependency tree
├── tsconfig.base.json              # Shared TypeScript base configuration
├── .github/
│   ├── pull_request_template.md    # PR template with required disclosures
│   └── workflows/ci.yml            # GitHub Actions CI workflow
├── shared/                         # Frozen contracts, enums, schemas, and fixtures
│   ├── CONTRACT_VERSION            # Contract version indicator (1)
│   ├── enums.ts                    # Canonical enums
│   ├── api.ts                      # Zod schemas and TypeScript types for all endpoints
│   ├── gemma.ts                    # Pass A and Pass B extraction schemas
│   ├── normalize.ts                # Deterministic text normalization
│   └── fixtures/api/               # Realistic JSON fixtures for every endpoint
├── server/                         # Express backend and database layer
│   ├── index.ts                    # Server entrypoint and route handlers
│   ├── db/                         # SQLite schema and connection management
│   └── llm/                        # Ollama client interface and cache key generator
├── apps/web/                       # Next.js frontend scaffold
└── tests/                          # Vitest contract and database tests
```

## License

This project is licensed under the [MIT License](./LICENSE) — Copyright (c) 2026 Vedant Satbhai.
