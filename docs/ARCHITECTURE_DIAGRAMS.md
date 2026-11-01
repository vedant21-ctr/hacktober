# DecisionVault — Architecture Diagrams

This document illustrates the technical architecture and pipeline flows of DecisionVault, strictly aligned with [`DecisionVault_Architecture_v3.md`](../DecisionVault_Architecture_v3.md).

---

## 1. GitHub Discussion Ingestion Flow

The ingestion pipeline fetches discussions from public repositories and issue trackers, caches raw payloads for reproducible offline processing, and normalizes text for deterministic search and evidence verification.

```mermaid
flowchart TD
    subgraph Sources["Untrusted Remote Sources"]
        GH["GitHub REST API<br/>(Issues, PRs, Comments)"]
        DC["Discourse API<br/>(discuss.python.org)"]
        LF["Local File Adapter<br/>(JSON discussions / PEP threads)"]
    end

    subgraph Ingest["Ingestion Layer (server/ingest/)"]
        Auth["Read-Only Auth Header<br/>(Server token only; stripped on cache)"]
        Prefilter["Deterministic Filter<br/>(Keyword signals + min comments)"]
        RawCache[("raw_responses Cache<br/>(SQLite raw storage)")]
    end

    subgraph Normalization["Normalization & Storage"]
        Norm["normalizeText()<br/>- Unicode NFKC<br/>- Lowercase<br/>- Straight quotes<br/>- Strip Markdown markers<br/>- Collapse whitespace"]
        DB_Sources[("sources Table<br/>Kind, URL, State, Base SHA")]
        DB_Comments[("comments Table<br/>idx, author, role, body, body_norm")]
        FTS_Comments[("comments_fts Virtual Table<br/>(FTS5 porter unicode61)")]
    end

    GH --> Auth --> Prefilter --> RawCache
    DC --> Prefilter --> RawCache
    LF --> Prefilter --> RawCache

    RawCache --> Norm
    Norm --> DB_Sources
    Norm --> DB_Comments
    DB_Comments -->|SQLite Trigger| FTS_Comments
```

---

## 2. Gemma Extraction Pipeline

Decision extraction uses a two-pass architecture with Google's **Gemma 4 E4B** (`gemma4:e4b`) running locally via Ollama. Thread comments are assigned anonymized thread-local identifiers (`c1`..`cN`) so Gemma never encounters or fabricates database primary keys or external URLs.

```mermaid
flowchart TD
    subgraph Input["Normalized Input"]
        Comments["Thread Comments<br/>(Ordered by idx)"]
        Chunker["Window Chunker<br/>(15-25 comments, 3-comment overlap)"]
    end

    subgraph PassA["Pass A: Window Classification"]
        PromptA["Prompt Pass A<br/>[c1][maintainer] text..."]
        OllamaA["Local Ollama Runtime<br/>(gemma4:e4b, temp=0, seed=42)"]
        SchemaA["Zod Schema Validation<br/>(labels: comment, label, alternative)"]
        LabelsDB[("labels Table<br/>proposal | objection | support |<br/>decision | rejection | clarification | noise")]
    end

    subgraph PassB["Pass B: Structured Decision Extraction"]
        Filter["Filter Significant Comments<br/>(proposals, objections, decisions, rejections)"]
        PromptB["Prompt Pass B<br/>Structured Extraction Schema"]
        OllamaB["Local Ollama Runtime<br/>(gemma4:e4b, JSON schema mode)"]
        SchemaB["Zod Schema Validation<br/>(decisions, alternatives, conditions, events)"]
    end

    subgraph ExtractionOutput["Candidate Extraction"]
        DecisionsCandidate["Extracted Decisions<br/>- Title & Summary<br/>- Status: accepted | rejected | unresolved<br/>- Decision Evidence Quotes"]
        AlternativesCandidate["Extracted Alternatives<br/>- Name & Description<br/>- Outcome: chosen | rejected | open<br/>- Rejection Reason & Category<br/>- Conditions with Probes"]
        EventsCandidate["Extracted Timeline Events<br/>- proposed, objected, agreed, decided, revised"]
    end

    Comments --> Chunker --> PromptA
    PromptA --> OllamaA --> SchemaA --> LabelsDB
    LabelsDB --> Filter
    Filter --> PromptB
    PromptB --> OllamaB --> SchemaB
    SchemaB --> DecisionsCandidate
    SchemaB --> AlternativesCandidate
    SchemaB --> EventsCandidate
```

---

## 3. Evidence Lock Verification Flow

The **Evidence Lock** is a 100% deterministic verification module. It enforces that every decision claim and rejection reason extracted by Gemma maps directly to verbatim historical text. Quotes that fail verification cannot contribute to decision confidence.

```mermaid
flowchart TD
    subgraph Candidate["Candidate Quote from Gemma"]
        QuoteInput["Gemma Quote + Comment ID (cN)"]
    end

    subgraph Verification["Deterministic Evidence Lock (server/verify/)"]
        CheckID{"Valid Comment ID<br/>in Thread?"}
        LoadBody["Load comments.body_norm"]
        NormQuote["normalizeText(quote)"]
        LengthCheck{"Length in<br/>[20, 400] chars?"}
        
        ExactMatch{"Substring match in<br/>comments.body_norm?"}
        FuzzyMatch{"Sliding-window Levenshtein<br/>similarity >= 0.90?"}
    end

    subgraph Verdict["Verification Classification"]
        ExactVerdict["verified = 1<br/>method = 'normalized_exact'<br/>match_score = 1.0<br/>Offsets stored (match_start, match_end)"]
        FuzzyVerdict["verified = 1<br/>method = 'fuzzy'<br/>match_score = [0.90, 0.99]<br/>Flagged as 'Approximate'"]
        NoneVerdict["verified = 0<br/>method = 'none'<br/>match_score = 0.0<br/>Flagged as 'Unverified Claim'"]
    end

    subgraph Confidence["Confidence Computation"]
        Coverage["coverage = verified_weight / total_claimed"]
        AuthorRole["statement = 1.0 (maintainer) | 0.6 (contributor) | 0.0"]
        ReasonCov["reason_cov = verified_reasons / rejected_alts"]
        Formula["confidence = 0.4*coverage + 0.4*statement + 0.2*reason_cov"]
        StoreDB[("evidence Table & decisions Table<br/>confidence, confidence_parts, last_verified_at")]
    end

    QuoteInput --> CheckID
    CheckID -- No --> NoneVerdict
    CheckID -- Yes --> LoadBody --> NormQuote --> LengthCheck
    LengthCheck -- No --> NoneVerdict
    LengthCheck -- Yes --> ExactMatch

    ExactMatch -- Yes --> ExactVerdict
    ExactMatch -- No --> FuzzyMatch

    FuzzyMatch -- Yes --> FuzzyVerdict
    FuzzyMatch -- No --> NoneVerdict

    ExactVerdict --> Confidence
    FuzzyVerdict --> Confidence
    NoneVerdict --> Confidence
    Confidence --> Coverage --> Formula
    Confidence --> AuthorRole --> Formula
    Confidence --> ReasonCov --> Formula
    Formula --> StoreDB
```

---

## 4. Decision-to-Code Connection Pipeline

DecisionVault connects recovered decisions to repository source code using a deterministic priority hierarchy. It inspects verified text and PR metadata, tracking Git file renames across time so decisions remain accessible even after files are moved or refactored.

```mermaid
flowchart TD
    subgraph SourcesOfPaths["Path Candidate Discovery"]
        Mentioned["1. Regex Path Mentions<br/>Scanned from verified quotes & comments<br/>(Must exist in Git tree at commit)"]
        PRDiff["2. PR File Diff Metadata<br/>Changed files associated with merged PR<br/>(Stores commit_sha)"]
        Symbol["3. Symbol Identification (Stretch)<br/>Backticked identifiers matched via git grep at HEAD"]
    end

    subgraph RenameResolution["Git Rename Tracker (server/link/)"]
        GitLog["git log --name-status -M --diff-filter=R<br/>One-pass repository rename map"]
        ChainFollow["Follow Historical Path -> Current HEAD Path<br/>path -> current_path"]
        StatusCheck{"File exists<br/>at HEAD?"}
        Resolved["current_path = 'src/new/path.ts'"]
        Removed["current_path = NULL<br/>(Deleted or superseded)"]
    end

    subgraph CodeStorage["Code Map Store"]
        DF[("decision_files Table<br/>decision_id, path, current_path,<br/>link_kind, basis, evidence_id")]
    end

    subgraph UserInterface["Developer Interfaces"]
        CodeMap["Code Map Tree Navigation<br/>GET /api/code/tree"]
        WhyCLI["'why <path>' Inspection<br/>GET /api/code/why?path=..."]
    end

    Mentioned --> GitLog
    PRDiff --> GitLog
    Symbol --> GitLog

    GitLog --> ChainFollow --> StatusCheck
    StatusCheck -- Yes --> Resolved --> DF
    StatusCheck -- No --> Removed --> DF

    DF --> CodeMap
    DF --> WhyCLI
```

---

## 5. Prior-Decision Warning Flow (Prior Art & Reopen Radar)

DecisionVault prevents relitigation through two complementary feedback mechanisms: **Prior Art Reports** (which warn developers before repeating rejected proposals) and **Reopen Radar** (which alerts maintainers when historical constraints no longer apply).

```mermaid
flowchart TD
    subgraph InputProposal["Developer Proposal Input"]
        InputType["Input Modality<br/>(Idea text | PR Number | Git Diff)"]
    end

    subgraph FeatureExtraction["Deterministic & Concept Extraction"]
        PathExtract["Extract Changed File Paths<br/>(from Diff or PR file list)"]
        ConceptExtract["Extract Search Concepts<br/>(3-6 technical keywords via Gemma/Lexical)"]
    end

    subgraph CandidateRetrieval["Hybrid Retrieval"]
        PathLookup["decision_files Lookup<br/>(historical path OR current_path)"]
        FTSLookup["decisions_fts & comments_fts<br/>(BM25 ranking on sanitized concepts)"]
        CandidateRank["Filter to Candidates with Verified Evidence<br/>(Capped at 8 candidates)"]
    end

    subgraph Classification["Gemma Conflict Classification"]
        Classifier["Gemma Classification Prompt<br/>conflicts | related | irrelevant<br/>+ Single-sentence explanation"]
    end

    subgraph ReopenRadar["Reopen Radar Probes (Constraint Health)"]
        ReadConditions["Read Associated Conditions from DB"]
        ProbeRunner["Deterministic Probes against HEAD:<br/>- python_requires (pyproject.toml)<br/>- node_engines (package.json)<br/>- dependency_present (lockfiles)<br/>- ci_python_matrix (.github/workflows)"]
        HealthEval{"Constraint Still Holds?"}
        Holds["state = 'holds'<br/>Historical constraint remains active"]
        MayNotHold["state = 'may_not_hold'<br/>Signal: e.g. Python 2.7 dropped, now >=3.8"]
        Unknown["state = 'unknown'<br/>Probe absent or ambiguous"]
    end

    subgraph Report["Prior Art Report Generation"]
        ReportOutput["PriorArtReport<br/>- Conflicts & Related Decisions<br/>- Rejection Reason & Verbatim Evidence<br/>- Conditions & Health Signals<br/>- reconsiderIf guidance"]
    end

    InputProposal --> InputType
    InputType --> PathExtract
    InputType --> ConceptExtract

    PathExtract --> PathLookup --> CandidateRank
    ConceptExtract --> FTSLookup --> CandidateRank

    CandidateRank --> Classifier
    CandidateRank --> ReadConditions --> ProbeRunner --> HealthEval

    HealthEval -- Still active --> Holds
    HealthEval -- Broken constraint --> MayNotHold
    HealthEval -- No probe --> Unknown

    Classifier --> ReportOutput
    Holds --> ReportOutput
    MayNotHold --> ReportOutput
    Unknown --> ReportOutput
```
