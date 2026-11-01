# DecisionVault — Eight-Minute Hackathon Pitch

> **Problem Statement 06:** Open Source Decision Intelligence and Knowledge Recovery  
> **Team:** Glitch (Vedant Satbhai, Prajjwal Tripathi, Hrishabh Prajapati, Adil Mirza)  
> **Target Pitch Duration:** Exactly 8 minutes (0:00 – 8:00)  
> **Presentation Modality:** Slides + Live Application Demonstration

---

## Pitch Timeline Overview

| Time Stamp | Section | Speaker / Presenter | Core Key Takeaway |
| :--- | :--- | :--- | :--- |
| **0:00 – 0:45** | Problem & Motivation | Lead Presenter | The critical loss of unwritten architectural knowledge & maintainer burnout |
| **0:45 – 1:30** | DecisionVault Solution | Lead Presenter | Automated decision ledger with Evidence Lock and Prior Art warnings |
| **1:30 – 2:30** | Architecture & Local Gemma | System Architect | 100% local Gemma 4 E4B, zero cloud AI, deterministic verification |
| **2:30 – 6:30** | Live Product Demonstration | Demo Lead | Real walkthrough: Explorer, Evidence Lock, Code Links, Sandbox |
| **6:30 – 7:30** | Technical Challenges & Trade-offs | Core Engineer | Handling rename tracking, hallucination elimination, FTS sync |
| **7:30 – 8:00** | Impact & Conclusion | Lead Presenter | Sustainable open-source maintenance & enterprise knowledge retention |

---

## 0:00 – 0:45 — Problem & Motivation

### Slide 1: The Invisible Knowledge Debt of Open Source

**Visual:** A diagram contrasting committed Git code (visible tip of the iceberg) with 10,000 closed issues and rejected PRs (hidden underwater mass).

**Spoken Script:**
> "Judges, consider this scenario: A passionate contributor opens a 500-line pull request proposing a threadpool architecture for an open-source project. Two days later, a weary maintainer closes it with a sigh: *'We debated this three years ago in issue #4128 and rejected it because mutex contention crushed throughput under load.'*
> 
> This is Problem Statement 06 in a nutshell. Software repositories remember *what* was committed to Git, but they completely forget *why* decisions were made, and more importantly, *why alternatives were rejected*. 
> 
> The consequence is compounding maintainer burnout, endlessly relitigating settled arguments, accidental regressions during refactors, and hundreds of wasted developer hours."

**Speaker Notes:**
- *Tone:* Urgent, empathetic to open-source maintainers.
- *Emphasis:* "Software remembers *what*, but completely forgets *why*."

---

## 0:45 – 1:30 — The DecisionVault Solution

### Slide 2: Introducing DecisionVault

**Visual:** The three core value pillars:
1. **Recover & Synthesize:** Turn messy discussions into structured architectural decisions.
2. **Evidence Lock:** Mathematically verify quotes against raw text to eliminate hallucination.
3. **Proactive Guardrails:** Warn developers *before* they repeat historically rejected designs.

**Spoken Script:**
> "Enter **DecisionVault**. DecisionVault is an automated decision intelligence and knowledge recovery platform built specifically to solve Problem Statement 06.
> 
> Rather than acting like a naive search bar or a hallucinating chatbot, DecisionVault operates as a strict, verified engineering ledger. 
> 
> It parses complex, multi-year discussion threads across GitHub and forums, separates accepted choices from rejected alternatives, locks every claim to verbatim source quotes, links decisions directly to source code across Git renames, and actively warns developers before they repeat rejected ideas."

**Speaker Notes:**
- Clearly state the difference: Not an ungrounded chat assistant, but a verified ledger.

---

## 1:30 – 2:30 — Technical Architecture & Local Gemma

### Slide 3: 100% Local Inference & Deterministic Verification

**Visual:** System Architecture Diagram:
`Discussion Sources ➔ Ingestion & Cache ➔ Pass A & Pass B (Gemma 4 E4B via Ollama) ➔ Deterministic Evidence Lock ➔ SQLite FTS5 ➔ Next.js UI`

**Spoken Script:**
> "Let’s look under the hood. Our technical architecture is guided by three strict principles:
> 
> First: **100% Local AI Privacy.** We use Google's **Gemma 4 E4B** running entirely locally on consumer hardware through Ollama. There are zero cloud AI SDKs, zero API tokens sent over the internet, and zero third-party embeddings.
> 
> Second: **Two-Pass Extraction.** A naive LLM call easily fabricates IDs or hallucinates quotes. We break extraction into **Pass A**, which classifies comment chunks into proposals and objections using thread-local IDs (`c1`..`cN`), and **Pass B**, which synthesizes structured decisions, alternatives, and conditions.
> 
> Third: **Deterministic Verification.** The LLM is never the final judge of truth. Our backend runs the **Evidence Lock**—a deterministic verification engine that checks every quoted claim against normalized source text (`body_norm`) using exact substring and sliding-window Levenshtein matching. If a quote cannot be verified, it receives zero confidence weight."

**Speaker Notes:**
- Highlight local reproducibility: "No cloud dependencies, runs on a standard laptop."
- Highlight that Gemma never emits database IDs or URLs.

---

## 2:30 – 6:30 — Live Product Demonstration

### Segment 2:30 – 3:30: The System Scaffold & Live Health Check

**Action on Screen:** Terminal showing `ollama ps` and web browser navigating to `http://localhost:3000`.

**Spoken Script:**
> "Let's see DecisionVault in action. We are currently demonstrating our Phase 1 milestone on branch `feat/demo-documentation`. 
> 
> Notice our backend status endpoint at `/api/status`. In real-time, it verifies that our SQLite database is active and connected to our local Ollama runtime running `gemma4:e4b`. 
> 
> In this milestone, all data contracts, TypeScript types, and Zod schemas are completely frozen under Contract Version 1, and our UI is rendering against our frozen contract fixtures."

---

### Segment 3:30 – 4:30: Decision Detail & Accepted vs. Rejected Alternatives

**Action on Screen:** Navigating to the Decision Explorer and clicking into *"Decouple Async I/O Event Loop from Core Protocol Parser"*.

**Spoken Script:**
> "Here is our core hero view: the **Decision Detail**. 
> 
> Look at the structured breakdown. Notice that DecisionVault doesn't just record what was merged; it highlights the **Evaluated Alternatives**.
> 
> Here is Alternative 1: *Zero-copy Ring Buffer*—marked with a green `Chosen` badge.
> 
> But right below it is the gold mine for maintainers: Alternative 2: *Worker Thread Threadpool with Synchronous Mutex Locking*—marked with a red `Rejected` badge. The system categorized the rejection reason under `Performance`, capturing the exact historical finding that mutex contention introduced latency spikes under concurrent packet bursts."

---

### Segment 4:30 – 5:30: The Evidence Lock in Action

**Action on Screen:** Scrolling to the Evidence Ledger; hovering over verification badges and confidence score.

**Spoken Script:**
> "Now, how do we know this isn't an AI hallucination?
> 
> Look at the **Evidence Ledger**. Every single claim is accompanied by a verification badge. 
> 
> When we click this green **Exact Verified** badge, the system shows that this quote matched normalized text in comment #12 with a `match_score` of 1.0. Notice the metadata: the quote is attributed to the author's GitHub handle with their verified repository role (`maintainer`), timestamp, and an immutable link to the original issue.
> 
> Our 91% confidence score is not self-reported by Gemma. It is computed algorithmically by our backend formula: 40% evidence coverage, 40% author authority weighting, and 20% rejection reason coverage."

---

### Segment 5:30 – 6:30: Code Linking & The Prior Art Warning Sandbox

**Action on Screen:** Viewing linked files (showing rename tracking) and switching to the `/sandbox` Proposal Sandbox.

**Spoken Script:**
> "Next, notice the **Associated Source Files**. A decision made three years ago against `legacy_channel.py` is automatically mapped through Git rename logs to its current location at `stream_channel.py`.
> 
> Finally, let's see how this protects developers. In our **Proposal Sandbox**, a developer inputs an idea: *'Let's add a threadpool with mutex locks.'* 
> 
> DecisionVault performs FTS5 retrieval, extracts the core concepts, and generates a **Prior Art Report**. It immediately warns the developer: **CONFLICT**. It surfaces the historical rejection reason and warns them before they spend two weeks writing code destined to be rejected!"

**Speaker Notes:**
- Ensure transitions between screens are smooth.
- Be transparent that live ingestion/extraction pipelines belong to Phase 2 while the contract and UI scaffold are live today.

---

## 6:30 – 7:30 — Technical Challenges & Design Decisions

### Slide 4: Engineering Challenges & Pragmatic Solutions

**Visual:** Comparison table of technical hurdles and resolutions:
1. *FTS5 Sync Triggers* (keeping virtual tables in sync without bloat).
2. *Hallucination Defense* (thread-local IDs + string offset matching).
3. *Git Rename Tracking* (single-pass `--diff-filter=R` resolution).
4. *Constraint Degradation* (Reopen Radar deterministic probes).

**Spoken Script:**
> "Building DecisionVault involved several non-trivial engineering challenges:
> 
> 1. **Preventing AI Fabrication:** By anonymizing comments to `c1`..`cN`, Gemma literally cannot fabricate fake database IDs or external URLs. All identifiers and links are injected by our backend from raw source rows.
> 2. **Maintaining Full-Text Search Integrity:** In SQLite, FTS5 virtual tables do not automatically index 1:N relational tables. We engineered custom SQLite database triggers that automatically concatenate and synchronize alternative names and reasons into `decisions_fts` whenever alternatives are inserted or updated.
> 3. **Git Rename Tracking at Scale:** Full Git history traversal can be slow. We implemented a single-pass rename parser using `git log --name-status -M`, enabling instant resolution of historical file paths to HEAD.
> 4. **Handling Dynamic Reality with Reopen Radar:** A decision rejected in 2018 because of Python 2.7 might be completely valid today. Instead of static rejections, our Reopen Radar uses deterministic AST and manifest probes to detect when old constraints have expired."

**Speaker Notes:**
- Speaks directly to the judges' technical appreciation for database triggers and Git internals.

---

## 7:30 – 8:00 — Impact & Conclusion

### Slide 5: The Future of Engineering Memory

**Visual:** Summary slide with GitHub repository link, MIT License badge, and Problem Statement 06 completion checklist.

**Spoken Script:**
> "To conclude: DecisionVault transforms open-source discussions from disposable text into a durable, auditable, and actionable engineering asset.
> 
> It stops maintainer burnout. It eliminates repetitive debates. It gives every engineering team institutional memory that survives contributor turnover.
> 
> And it achieves all of this with complete user privacy, running 100% locally with open-source Gemma 4 E4B.
> 
> Thank you, and we welcome your questions!"

**Speaker Notes:**
- Conclude firmly at the 7:55 mark to allow a 5-second buffer before the hard 8:00 cutoff.
- Prepare to field questions on Gemma prompt strategies and SQLite FTS5 triggers.
