# DecisionVault

## Team Details

- **Team Name:** Glitch
- **Team Members:**
  1. Vedant Satbhai
  2. Prajjwal Tripathi
  3. Hrishabh Prajapati
  4. Adil Mirza

## Selected Problem Statement

**Problem 06: Open Source Decision Intelligence and Knowledge Recovery**

**Category:** Knowledge Management | Developer Intelligence | Information Retrieval

## Project Overview

DecisionVault is an AI-powered engineering knowledge recovery platform that extracts and preserves technical decisions from open-source project discussions.

It analyzes GitHub issues, pull requests, and technical discussions to identify accepted decisions, rejected alternatives, and their underlying reasoning.

Developers can search historical decisions, inspect verified quotes anchored in source discussions, and receive warnings before repeating historically rejected ideas.

## Core Features

1. GitHub issue and pull request discussion ingestion.
2. AI-powered technical decision extraction.
3. Identification of accepted and rejected alternatives.
4. Extraction of technical reasoning and trade-offs.
5. Searchable engineering knowledge base with SQLite FTS5.
6. AI-powered repository question answering grounded strictly in retrieved evidence.
7. References to original discussions for evidence and traceability (Evidence Lock).
8. Prior Art analysis and Reopen Radar constraint tracking.

## AI Models Used

### Gemma 4 E4B

- **Provider:** Google
- **Model:** `gemma4:e4b`
- **Runtime:** Ollama (`http://localhost:11434`)
- **Execution:** Locally on the development machine.

### Model Justification

Gemma 4 E4B is selected for its ability to understand technical discussions, extract structured information, identify engineering decisions, analyze alternatives, and generate contextual answers.

It will perform the core AI functionality of DecisionVault, including decision extraction, reasoning analysis, classification, and question answering.

Running Gemma locally avoids dependence on cloud-based AI services and keeps discussion processing within the local environment.

No additional AI models or cloud-based AI APIs will be used.

## Technology Stack

- **Frontend:** Next.js (App Router), React, Tailwind CSS
- **Backend:** Node.js, Express, Zod, better-sqlite3
- **Database & Search:** SQLite + FTS5
- **AI Model:** Gemma 4 E4B (local Ollama)
- **Testing & E2E:** Vitest, Playwright
- **CI/CD:** GitHub Actions

## Open-Source License

MIT License

## Development Tools & Coding Assistants

- **Gemini 3.8 High / Argon** (Google Antigravity)

Used strictly as an AI coding assistant during development. It is not integrated into the application as an inference service or runtime dependency.
