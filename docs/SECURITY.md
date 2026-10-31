# DecisionVault — Security Model & Practices

This document outlines the security architecture, input defenses, vulnerability management, and developer practices for DecisionVault.

---

## 1. Security Architecture & Threat Model

DecisionVault processes public discussions, issues, and pull requests from open-source repositories. All content retrieved from the web or uploaded via adapters is treated as **untrusted data**.

### Core Tenets

1. **Local-Only Inference:**
   - The only AI model supported in the product is `gemma4:e4b` through local Ollama (`http://localhost:11434`).
   - Discussion contents and internal queries are never transmitted to external cloud AI providers.
2. **Read-Only Ingestion:**
   - DecisionVault only reads public repositories and discussions.
   - It never posts comments, opens issues, or creates pull requests on remote repositories.
3. **No Code Execution:**
   - DecisionVault analyzes repository text and git logs. It never compiles, executes, or evaluates repository code or diffs.

---

## 2. Input Defenses & Hardening

### A. SQL Injection Prevention

- All SQLite queries in the application use parameterized SQL queries (`db.prepare('... WHERE id = ?').run(id)`).
- FTS5 search queries sanitize user input by stripping raw syntax markers and wrapping search terms in double quotes to prevent MATCH syntax abuse.
- Direct string concatenation into SQL statements is prohibited.

### B. Path Traversal Defenses

- File adapters and code map queries reject paths containing `..` or leading directory traversal attempts.
- Cloned repositories are stored in an isolated data directory and verified against repository boundary paths.

### C. Prompt Injection Defense

- Discussion comments provided to Gemma are treated as pure data.
- System prompts explicitly direct Gemma to ignore instructions inside user discussion bodies.
- Gemma has zero tool or execution privileges.
- Outputs are strictly validated against Zod schemas; extracted quotes must match normalized database text verbatim via the deterministic **Evidence Lock**.

### D. Control Characters & Content Sanitization

- `normalizeText()` strips non-printable control characters (`\x00-\x1F` except tab and newline, and `\x7F`).
- HTML bodies in discussions are rendered as plain text in the UI to prevent XSS.

### E. Error Leakage Prevention

- Server route error handlers return standard, structured error objects:
  ```json
  {
    "error": {
      "code": "STRING_CODE",
      "message": "Sanitized error message."
    }
  }
  ```
- Internal stack traces, server file paths, and environment secrets are never exposed to HTTP clients in production.

---

## 3. Dependency Management & CI Scanning

- **Dependabot:** Configured in `.github/dependabot.yml` to monitor npm packages and GitHub Actions for known vulnerabilities.
- **CodeQL:** Static Application Security Testing (SAST) runs automatically on every pull request and push to `main` via `.github/workflows/codeql.yml`.
- **Audit Enforcement:** CI runs `npm audit --audit-level=critical` on every build.
- **Zero Secret Commits:** Git commits must never include tokens, credentials, or `.env` files.

---

## 4. Reporting a Security Vulnerability

If you discover a security vulnerability in DecisionVault, please report it privately to the project owner:

- **Developer:** Vedant Satbhai
- **Project:** DecisionVault (Problem Statement 06)
