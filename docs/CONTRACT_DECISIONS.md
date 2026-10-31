# DecisionVault — Contract Decisions and Discrepancies Register

This document records architectural discrepancies, technical challenges, and the resolutions chosen during Phase 1 (Contract Freeze) in accordance with the DecisionVault Architecture Discrepancy Policy.

---

## Decision 1: Full-Text Search (FTS5) Synchronization and `alternatives_text`

### 1. Original Specification

Section 6 specifies:

```sql
CREATE VIRTUAL TABLE decisions_fts USING fts5(
  title,
  summary,
  alternatives_text,
  tokenize = 'porter unicode61'
);
```

### 2. Technical Problem

The `decisions` table columns are:
`id`, `source_id`, `run_id`, `title`, `status`, `lifecycle`, `summary`, `confidence`, `confidence_parts`, `last_verified_at`, `created_at`.

There is no `alternatives_text` column on the `decisions` table. Alternatives are stored in a separate 1:N normalized table (`alternatives` referencing `decision_id`), which contains `name`, `description`, `outcome`, `reason`, and `reason_category`. If `decisions_fts` were left without explicit synchronization triggers or maintenance mechanisms, indexing decisions with their associated alternative names and reasons would be unmaintainable and fail to reflect alternative updates.

### 3. Chosen Resolution

1. Keep the `decisions_fts` virtual table schema exactly as specified with columns `(title, summary, alternatives_text, tokenize = 'porter unicode61')`.
2. Add explicit SQLite triggers in `server/db/schema.sql`:
   - `decisions_ai`: On inserting a decision, inserts `(rowid, title, summary, alternatives_text)` into `decisions_fts` where `alternatives_text` is initially empty (or concatenated from existing alternatives if any).
   - `decisions_ad`: On deleting a decision, removes the corresponding row from `decisions_fts`.
   - `decisions_au`: On updating a decision's `title` or `summary`, updates `decisions_fts` using FTS5 `'delete'` and re-inserts with the current aggregated alternatives text.
   - `alternatives_ai`, `alternatives_au`, `alternatives_ad`: When alternatives are inserted, updated, or deleted, triggers re-sync the corresponding decision's `alternatives_text` in `decisions_fts` by concatenating `name` and `description` of all alternatives for that `decision_id`.
3. Provide equivalent synchronization triggers (`comments_ai`, `comments_ad`, `comments_au`) for `comments_fts`.

### 4. Reason for Resolution

This resolution strictly preserves the exact table name and column structure expected by retrieval queries (`title`, `summary`, `alternatives_text`) in Section 13, ensures search hits match the decision's rowid, and automatically keeps the index in sync without requiring application-level manual reindexing.

---

## Decision 2: API Fixtures Placement vs Repository Fixtures

### 1. Original Specification

- Section 0 and Section 11 state: "Fixtures for each shape live in `shared/fixtures/api/`."
- Section 5 repository layout shows:
  - `shared/ # ... fixtures/api/*.json`
  - `fixtures/ # recorded Gemma responses (replay) + sample threads`

### 2. Technical Problem

Potential confusion regarding whether API contract fixtures belong under the top-level `fixtures/` or `shared/fixtures/api/`.

### 3. Chosen Resolution

- All frozen REST API response fixtures are placed in `shared/fixtures/api/`.
- The root `fixtures/` directory is created and reserved for recorded LLM responses (`replay` mode fixtures) and sample raw discussion threads.

### 4. Reason for Resolution

`shared` must be an independent package usable by both `server` and `apps/web`. Co-locating API contract fixtures within `shared/fixtures/api/` allows tests and frontend mock environments to import the contract fixtures directly without depending on server-side or root test data.

---

## Decision 3: Gemma Pass B Output vs Database Evidence Claim Types

### 1. Original Specification

In Section 8.4 (Pass B output schema):

- Decision evidence items are returned under `"decision_evidence": [ { "comment": "c12", "quote": "..." } ]`.
- Alternative evidence items are returned under `"evidence": [ { "comment": "c9", "quote": "...", "claim": "rejection_reason|proposal" } ]`.
- In Section 6, the `evidence` table requires `claim_type IN ('decision_statement','rejection_reason','proposal','condition','event')`.

### 2. Technical Problem

Pass B output uses `claim: "rejection_reason|proposal"` inside alternative evidence and does not have an explicit `claim` field in `decision_evidence` (since it is implicitly a `decision_statement`).

### 3. Chosen Resolution

In `shared/gemma.ts`:

- Pass B schema explicitly validates `decision_evidence` as `{ comment: string, quote: string }` and alternative `evidence` as `{ comment: string, quote: string, claim: "rejection_reason" | "proposal" }`.
- In backend ingestion mapping (Phase 2), `decision_evidence` entries are mapped to `evidence.claim_type = 'decision_statement'`.
- All claim types (`decision_statement`, `rejection_reason`, `proposal`, `condition`, `event`) are defined in `shared/enums.ts` under `claimTypeValues` to cover the full database and API evidence contracts.

### 4. Reason for Resolution

Maintains strict alignment with Section 8.4 prompt output expectations for Gemma while preserving type safety and relational integrity with the Section 6 database schema.

---

## Decision 4: Job ID and Parameter Types Across API Contracts

### 1. Original Specification

Section 11 lists `POST /api/imports`, `POST /api/extract`, `POST /api/radar/recheck`, `POST /api/benchmark/run`, and `POST /api/sandbox/prior-art` returning `202 { jobId }`, and `GET /api/jobs/:id` returning `{ id, type, status, stage, ... }`.

### 2. Technical Problem

The specification mentions both numeric IDs in the DB schema (`INTEGER PRIMARY KEY`) and string representations in URL paths (`:id`).

### 3. Chosen Resolution

- In all API responses, `jobId` and `id` are typed as `number` (integer).
- URL route parameters in Express and query schemas use Zod coercion (`z.coerce.number().int()`) to cleanly parse string path/query parameters into numbers.

### 4. Reason for Resolution

Prevents type confusion between database integer primary keys and HTTP route parameters, ensuring clean end-to-end validation.
