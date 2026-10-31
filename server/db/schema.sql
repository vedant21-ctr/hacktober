-- DecisionVault Database Schema (Architecture v3 Section 6)
-- Conventions: ISO-8601 UTC strings for timestamps; PRAGMA foreign_keys = ON; JSON stored as TEXT.

PRAGMA foreign_keys = ON;

-- Raw API responses kept separately so everything can be reprocessed offline.
CREATE TABLE IF NOT EXISTS raw_responses (
  id            INTEGER PRIMARY KEY,
  provider      TEXT NOT NULL CHECK (provider IN ('github','discourse','file')),
  request_key   TEXT NOT NULL UNIQUE,          -- URL+params or file path
  http_status   INTEGER NOT NULL,
  etag          TEXT,
  fetched_at    TEXT NOT NULL,
  body          TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS repositories (
  id              INTEGER PRIMARY KEY,
  full_name       TEXT NOT NULL UNIQUE,        -- owner/repo
  default_branch  TEXT,
  head_commit_sha TEXT,
  clone_path      TEXT,
  imported_at     TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sources (
  id              INTEGER PRIMARY KEY,
  repo_id         INTEGER REFERENCES repositories(id) ON DELETE CASCADE,
  kind            TEXT NOT NULL CHECK (kind IN ('github_issue','github_pr','discourse_topic','pep_discussion')),
  external_id     TEXT NOT NULL UNIQUE,        -- namespaced, e.g. owner/repo#123, discourse:python:12345
  url             TEXT NOT NULL,
  title           TEXT NOT NULL,
  state           TEXT,                        -- open|closed|merged
  created_at      TEXT,
  closed_at       TEXT,
  base_commit_sha TEXT,                        -- for PRs, where available
  raw_response_id INTEGER REFERENCES raw_responses(id)
);
CREATE INDEX IF NOT EXISTS idx_sources_repo ON sources(repo_id);

CREATE TABLE IF NOT EXISTS comments (
  id                INTEGER PRIMARY KEY,
  source_id         INTEGER NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  external_id       TEXT NOT NULL,
  parent_comment_id INTEGER REFERENCES comments(id) ON DELETE SET NULL,
  idx               INTEGER NOT NULL,          -- order within the source
  author            TEXT NOT NULL,
  author_role       TEXT NOT NULL DEFAULT 'unknown'
                    CHECK (author_role IN ('owner','member','collaborator','contributor','none','unknown')),
  created_at        TEXT NOT NULL,
  body              TEXT NOT NULL,
  body_norm         TEXT NOT NULL,             -- normalized form used by Evidence Lock
  url               TEXT NOT NULL,
  UNIQUE (source_id, external_id)
);
CREATE INDEX IF NOT EXISTS idx_comments_source ON comments(source_id, idx);

-- FTS5 index for comments; rowid = comments.id
CREATE VIRTUAL TABLE IF NOT EXISTS comments_fts USING fts5(
  body,
  tokenize = 'porter unicode61'
);

CREATE TABLE IF NOT EXISTS runs (
  id             INTEGER PRIMARY KEY,
  kind           TEXT NOT NULL CHECK (kind IN ('extract_a','extract_b','health','ask','prior_art','benchmark','other')),
  model          TEXT NOT NULL,
  mode           TEXT NOT NULL CHECK (mode IN ('live','record','replay')),
  prompt_version TEXT NOT NULL,
  params_json    TEXT NOT NULL,
  started_at     TEXT NOT NULL,
  finished_at    TEXT,
  status         TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running','succeeded','failed'))
);

-- Pass A output
CREATE TABLE IF NOT EXISTS labels (
  comment_id INTEGER NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  run_id     INTEGER NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  label      TEXT NOT NULL CHECK (label IN ('proposal','objection','support','decision','rejection','clarification','noise')),
  alt_name   TEXT,
  PRIMARY KEY (comment_id, run_id)
);

CREATE TABLE IF NOT EXISTS decisions (
  id               INTEGER PRIMARY KEY,
  source_id        INTEGER NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  run_id           INTEGER NOT NULL REFERENCES runs(id),
  title            TEXT NOT NULL,
  status           TEXT NOT NULL CHECK (status IN ('accepted','rejected','unresolved')),
  lifecycle        TEXT NOT NULL DEFAULT 'active' CHECK (lifecycle IN ('active','superseded')),
  summary          TEXT NOT NULL,
  confidence       REAL NOT NULL CHECK (confidence BETWEEN 0 AND 1),   -- computed by backend
  confidence_parts TEXT NOT NULL,                                       -- JSON breakdown
  last_verified_at TEXT,
  created_at       TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_decisions_source ON decisions(source_id);
CREATE INDEX IF NOT EXISTS idx_decisions_status ON decisions(status, lifecycle);

-- FTS5 index for decisions; rowid = decisions.id
CREATE VIRTUAL TABLE IF NOT EXISTS decisions_fts USING fts5(
  title,
  summary,
  alternatives_text,
  tokenize = 'porter unicode61'
);

CREATE TABLE IF NOT EXISTS alternatives (
  id              INTEGER PRIMARY KEY,
  decision_id     INTEGER NOT NULL REFERENCES decisions(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  description     TEXT NOT NULL,
  outcome         TEXT NOT NULL CHECK (outcome IN ('chosen','rejected','open')),
  reason          TEXT,
  reason_category TEXT CHECK (reason_category IN
                    ('compatibility','performance','security','maintenance','complexity','policy','infrastructure','other'))
);
CREATE INDEX IF NOT EXISTS idx_alt_decision ON alternatives(decision_id);

CREATE TABLE IF NOT EXISTS evidence (
  id                  INTEGER PRIMARY KEY,
  decision_id         INTEGER NOT NULL REFERENCES decisions(id) ON DELETE CASCADE,
  alternative_id      INTEGER REFERENCES alternatives(id) ON DELETE CASCADE,
  comment_id          INTEGER NOT NULL REFERENCES comments(id),
  claim_type          TEXT NOT NULL CHECK (claim_type IN ('decision_statement','rejection_reason','proposal','condition','event')),
  quote               TEXT NOT NULL,
  verified            INTEGER NOT NULL CHECK (verified IN (0,1)),
  verification_method TEXT NOT NULL CHECK (verification_method IN ('normalized_exact','fuzzy','none')),
  match_score         REAL NOT NULL CHECK (match_score BETWEEN 0 AND 1),
  match_start         INTEGER,                 -- offset in comments.body_norm when matched
  match_end           INTEGER,
  created_at          TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_evidence_decision ON evidence(decision_id);
CREATE INDEX IF NOT EXISTS idx_evidence_comment ON evidence(comment_id);

CREATE TABLE IF NOT EXISTS conditions (
  id              INTEGER PRIMARY KEY,
  alternative_id  INTEGER NOT NULL REFERENCES alternatives(id) ON DELETE CASCADE,
  evidence_id     INTEGER REFERENCES evidence(id),
  text            TEXT NOT NULL,
  kind            TEXT NOT NULL CHECK (kind IN ('version','infrastructure','dependency','performance','security','maintenance','policy','other')),
  probe           TEXT NOT NULL DEFAULT 'none' CHECK (probe IN ('python_requires','node_engines','dependency_present','ci_python_matrix','later_mentions','none')),
  probe_value     TEXT,                        -- e.g. "2.7", package name
  last_checked_at TEXT
);

CREATE TABLE IF NOT EXISTS health (
  id             INTEGER PRIMARY KEY,
  condition_id   INTEGER NOT NULL REFERENCES conditions(id) ON DELETE CASCADE,
  run_id         INTEGER REFERENCES runs(id),
  state          TEXT NOT NULL DEFAULT 'unknown' CHECK (state IN ('holds','may_not_hold','unknown')),
  signal_type    TEXT,                         -- which probe produced the signal
  signal_path    TEXT,                         -- file inspected
  signal_value   TEXT,                         -- actual value read
  commit_sha     TEXT,
  details        TEXT,                         -- deterministic explanation
  interpretation TEXT,                         -- Gemma wording, only when a signal exists
  checked_at     TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_health_condition ON health(condition_id, checked_at);

CREATE TABLE IF NOT EXISTS decision_files (
  id             INTEGER PRIMARY KEY,
  decision_id    INTEGER NOT NULL REFERENCES decisions(id) ON DELETE CASCADE,
  path           TEXT NOT NULL,                -- path as referenced historically
  current_path   TEXT,                         -- resolved path at HEAD, NULL if deleted/unknown
  link_kind      TEXT NOT NULL CHECK (link_kind IN ('mentioned','pr_diff','rename_tracked','symbol')),
  basis          TEXT NOT NULL,                -- human-readable reason for the link
  evidence_id    INTEGER REFERENCES evidence(id),
  commit_sha     TEXT,
  symbol_name    TEXT,
  UNIQUE (decision_id, path, link_kind, symbol_name)
);
CREATE INDEX IF NOT EXISTS idx_df_current ON decision_files(current_path);
CREATE INDEX IF NOT EXISTS idx_df_path ON decision_files(path);

CREATE TABLE IF NOT EXISTS decision_events (
  id          INTEGER PRIMARY KEY,
  decision_id INTEGER NOT NULL REFERENCES decisions(id) ON DELETE CASCADE,
  comment_id  INTEGER NOT NULL REFERENCES comments(id),
  evidence_id INTEGER REFERENCES evidence(id),
  event_type  TEXT NOT NULL CHECK (event_type IN ('proposed','objected','agreed','decided','revised')),
  occurred_at TEXT NOT NULL,
  source_url  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_events_decision ON decision_events(decision_id, occurred_at);

CREATE TABLE IF NOT EXISTS decision_relationships (
  id                 INTEGER PRIMARY KEY,
  source_decision_id INTEGER NOT NULL REFERENCES decisions(id) ON DELETE CASCADE,  -- newer
  target_decision_id INTEGER NOT NULL REFERENCES decisions(id) ON DELETE CASCADE,  -- older
  relationship_type  TEXT NOT NULL CHECK (relationship_type IN ('supersedes','contradicts','revisits','supports')),
  evidence_id        INTEGER NOT NULL REFERENCES evidence(id),                      -- mandatory
  created_at         TEXT NOT NULL,
  CHECK (source_decision_id <> target_decision_id),
  UNIQUE (source_decision_id, target_decision_id, relationship_type)
);

-- Benchmark (auditable)
CREATE TABLE IF NOT EXISTS benchmark_cases (
  id         INTEGER PRIMARY KEY,
  name       TEXT NOT NULL,
  pep_number INTEGER,
  source_id  INTEGER REFERENCES sources(id),   -- the discussion given to the pipeline
  gold_hash  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS benchmark_gold (
  id          INTEGER PRIMARY KEY,
  case_id     INTEGER NOT NULL REFERENCES benchmark_cases(id) ON DELETE CASCADE,
  idx         INTEGER NOT NULL,
  name        TEXT NOT NULL,
  description TEXT NOT NULL,
  reason      TEXT NOT NULL,
  UNIQUE (case_id, idx)
);

CREATE TABLE IF NOT EXISTS benchmark_runs (
  id              INTEGER PRIMARY KEY,
  case_id         INTEGER NOT NULL REFERENCES benchmark_cases(id) ON DELETE CASCADE,
  run_id          INTEGER NOT NULL REFERENCES runs(id),
  predicted_count INTEGER NOT NULL,
  matched_count   INTEGER NOT NULL,
  gold_count      INTEGER NOT NULL,
  precision       REAL, recall REAL, f1 REAL,
  reason_accuracy REAL,
  review_status   TEXT NOT NULL CHECK (review_status IN ('unreviewed','human_confirmed')),
  created_at      TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS benchmark_matches (
  id               INTEGER PRIMARY KEY,
  benchmark_run_id INTEGER NOT NULL REFERENCES benchmark_runs(id) ON DELETE CASCADE,
  gold_id          INTEGER NOT NULL REFERENCES benchmark_gold(id),
  alternative_id   INTEGER NOT NULL REFERENCES alternatives(id),
  suggested_by     TEXT NOT NULL CHECK (suggested_by IN ('lexical','gemma','human')),
  lexical_score    REAL,
  confirmed        INTEGER NOT NULL DEFAULT 0 CHECK (confirmed IN (0,1)),
  reason_grade     REAL CHECK (reason_grade IN (0, 0.5, 1)),   -- human-assigned
  UNIQUE (benchmark_run_id, gold_id, alternative_id)
);

-- ==========================================
-- Triggers for FTS5 Synchronization
-- ==========================================

-- Comments FTS Synchronization
CREATE TRIGGER IF NOT EXISTS comments_ai AFTER INSERT ON comments
BEGIN
  INSERT INTO comments_fts(rowid, body) VALUES (new.id, new.body);
END;

CREATE TRIGGER IF NOT EXISTS comments_ad AFTER DELETE ON comments
BEGIN
  DELETE FROM comments_fts WHERE rowid = old.id;
END;

CREATE TRIGGER IF NOT EXISTS comments_au AFTER UPDATE ON comments
BEGIN
  DELETE FROM comments_fts WHERE rowid = old.id;
  INSERT INTO comments_fts(rowid, body) VALUES (new.id, new.body);
END;

-- Decisions FTS Synchronization
CREATE TRIGGER IF NOT EXISTS decisions_ai AFTER INSERT ON decisions
BEGIN
  INSERT INTO decisions_fts(rowid, title, summary, alternatives_text)
  VALUES (
    new.id,
    new.title,
    new.summary,
    COALESCE((SELECT group_concat(name || ' ' || description, ' ') FROM alternatives WHERE decision_id = new.id), '')
  );
END;

CREATE TRIGGER IF NOT EXISTS decisions_ad AFTER DELETE ON decisions
BEGIN
  DELETE FROM decisions_fts WHERE rowid = old.id;
END;

CREATE TRIGGER IF NOT EXISTS decisions_au AFTER UPDATE ON decisions
BEGIN
  DELETE FROM decisions_fts WHERE rowid = old.id;
  INSERT INTO decisions_fts(rowid, title, summary, alternatives_text)
  VALUES (
    new.id,
    new.title,
    new.summary,
    COALESCE((SELECT group_concat(name || ' ' || description, ' ') FROM alternatives WHERE decision_id = new.id), '')
  );
END;

-- When an alternative is added/updated/deleted, update decisions_fts for that decision
CREATE TRIGGER IF NOT EXISTS alternatives_ai AFTER INSERT ON alternatives
BEGIN
  DELETE FROM decisions_fts WHERE rowid = new.decision_id;
  INSERT INTO decisions_fts(rowid, title, summary, alternatives_text)
  SELECT
    d.id,
    d.title,
    d.summary,
    COALESCE((SELECT group_concat(name || ' ' || description, ' ') FROM alternatives WHERE decision_id = d.id), '')
  FROM decisions d WHERE d.id = new.decision_id;
END;

CREATE TRIGGER IF NOT EXISTS alternatives_au AFTER UPDATE ON alternatives
BEGIN
  DELETE FROM decisions_fts WHERE rowid = old.decision_id;
  INSERT INTO decisions_fts(rowid, title, summary, alternatives_text)
  SELECT
    d.id,
    d.title,
    d.summary,
    COALESCE((SELECT group_concat(name || ' ' || description, ' ') FROM alternatives WHERE decision_id = d.id), '')
  FROM decisions d WHERE d.id = old.decision_id;

  DELETE FROM decisions_fts WHERE rowid = new.decision_id;
  INSERT INTO decisions_fts(rowid, title, summary, alternatives_text)
  SELECT
    d.id,
    d.title,
    d.summary,
    COALESCE((SELECT group_concat(name || ' ' || description, ' ') FROM alternatives WHERE decision_id = d.id), '')
  FROM decisions d WHERE d.id = new.decision_id;
END;

CREATE TRIGGER IF NOT EXISTS alternatives_ad AFTER DELETE ON alternatives
BEGIN
  DELETE FROM decisions_fts WHERE rowid = old.decision_id;
  INSERT INTO decisions_fts(rowid, title, summary, alternatives_text)
  SELECT
    d.id,
    d.title,
    d.summary,
    COALESCE((SELECT group_concat(name || ' ' || description, ' ') FROM alternatives WHERE decision_id = d.id), '')
  FROM decisions d WHERE d.id = old.decision_id;
END;

