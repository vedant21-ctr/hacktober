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

Developers can search historical decisions and ask questions about a repository to understand its architectural choices and technical history.

## Core Features

1. GitHub issue and pull request discussion ingestion.
2. AI-powered technical decision extraction.
3. Identification of accepted and rejected alternatives.
4. Extraction of technical reasoning and trade-offs.
5. Searchable engineering knowledge base.
6. AI-powered repository question answering.
7. References to original discussions for evidence and traceability.

## AI Models Used

### Gemma 4 E4B

- **Provider:** Google
- **Model:** `gemma4:e4b`
- **Runtime:** Ollama
- **Execution:** Locally on the development machine.

### Model Justification

Gemma 4 E4B is selected for its ability to understand technical discussions, extract structured information, identify engineering decisions, analyze alternatives, and generate contextual answers.

It will perform the core AI functionality of DecisionVault, including decision extraction, reasoning analysis, classification, and question answering.

Running Gemma locally avoids dependence on cloud-based AI services and keeps discussion processing within the local environment.

No additional AI models or cloud-based AI APIs will be used.

## Technology Stack

- Frontend: Next.js, TypeScript, Tailwind CSS
- Backend: Node.js
- Database: SQLite
- AI Model: Gemma 4 E4B
- Model Runtime: Ollama
- GitHub Integration: GitHub REST API
- Search: SQLite FTS5
- CI/CD: GitHub Actions

## Open-Source License

MIT License

## Development Tools

- Antigravity Pro
- Claude

These tools are used as AI coding assistants during development. They are not integrated into the application as AI inference services.
