import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import type { Database } from 'better-sqlite3';
import { getDatabase } from '../db/index.js';
import type {
  DecisionCard,
  DecisionFile,
  CodeTreeNode,
  CodeWhyResponse,
} from '@decisionvault/shared/api';
import type { DecisionFileLinkKind } from '@decisionvault/shared/enums';

/**
 * Recognized source code, config, and document extensions.
 */
export const VALID_FILE_EXTENSIONS = new Set([
  'ts',
  'tsx',
  'js',
  'jsx',
  'mjs',
  'cjs',
  'json',
  'py',
  'pyi',
  'rb',
  'go',
  'rs',
  'c',
  'cpp',
  'cc',
  'cxx',
  'h',
  'hpp',
  'java',
  'kt',
  'scala',
  'cs',
  'php',
  'swift',
  'sh',
  'bash',
  'sql',
  'yaml',
  'yml',
  'toml',
  'ini',
  'cfg',
  'conf',
  'env',
  'md',
  'mdx',
  'html',
  'htm',
  'css',
  'scss',
  'sass',
  'less',
  'xml',
  'svg',
  'txt',
  'lock',
  'rst',
]);

/**
 * Recognized exact filenames without typical extensions.
 */
export const VALID_STANDALONE_FILENAMES = new Set([
  'dockerfile',
  'makefile',
  'cmakelists.txt',
  'readme',
  'license',
  'package.json',
  'tsconfig.json',
  'requirements.txt',
  'setup.py',
  'pyproject.toml',
  '.gitignore',
  '.env.example',
]);

/**
 * Candidate file association before precedence deduplication.
 */
export interface CandidateFileLink {
  path: string;
  currentPath: string | null;
  linkKind: DecisionFileLinkKind;
  basis: string;
  evidenceId?: number | null;
  commitSha?: string | null;
  symbolName?: string | null;
  priority: number; // 4: verified quote, 3: pr_diff / rename_tracked, 2: pr review comment, 1: comment body
}

/**
 * Scans a local git clone (if available on disk) for rename history.
 */
export function scanGitRenames(clonePath?: string | null): Map<string, string> {
  const gitRenames = new Map<string, string>();
  if (!clonePath || typeof clonePath !== 'string') return gitRenames;

  try {
    if (!fs.existsSync(clonePath)) return gitRenames;
    const gitDir = path.join(clonePath, '.git');
    if (!fs.existsSync(gitDir)) return gitRenames;

    const stdout = execFileSync('git', ['log', '--diff-filter=R', '--name-status', '--format='], {
      cwd: clonePath,
      encoding: 'utf-8',
      timeout: 5000,
      stdio: ['ignore', 'pipe', 'ignore'],
    });

    const lines = stdout.split(/\r?\n/);
    // Git log outputs from newest to oldest; process oldest to newest to follow chains
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i].trim();
      if (!line.startsWith('R')) continue;
      const parts = line.split(/\t+/);
      if (parts.length >= 3) {
        const oldP = normalizeFilePath(parts[1]);
        const newP = normalizeFilePath(parts[2]);
        if (oldP && newP) {
          for (const [orig, target] of gitRenames.entries()) {
            if (target === oldP) {
              gitRenames.set(orig, newP);
            }
          }
          gitRenames.set(oldP, newP);
        }
      }
    }
  } catch {
    // Non-fatal if git is unavailable or repo has no commits
  }

  return gitRenames;
}

/**
 * Builds a repository-wide file status map from cached PR file entries in raw_responses.
 * Resolves rename chains (A -> B -> C) and deletions (C -> removed / null).
 */
export function buildRepositoryFileStatusMap(
  repoId: number,
  db: Database,
  clonePath?: string | null,
): Map<string, { currentPath: string | null; isDeleted: boolean }> {
  const statusMap = new Map<string, { currentPath: string | null; isDeleted: boolean }>();

  // Fetch repository full name
  const repoRow = db
    .prepare('SELECT full_name, clone_path FROM repositories WHERE id = ?')
    .get(repoId) as { full_name: string; clone_path: string | null } | undefined;

  const repoFullName = repoRow?.full_name;
  const effectiveClonePath = clonePath || repoRow?.clone_path;

  // 1. Incorporate local git renames if clone is present
  const gitRenames = scanGitRenames(effectiveClonePath);
  for (const [oldP, newP] of gitRenames.entries()) {
    statusMap.set(oldP, { currentPath: newP, isDeleted: false });
  }

  // 2. Query cached PR files belonging to this repository
  let rawFileRows: Array<{ body: string }> = [];
  if (repoFullName) {
    rawFileRows = db
      .prepare(
        `SELECT body FROM raw_responses
         WHERE provider = 'github' AND request_key LIKE ?
         ORDER BY id ASC`,
      )
      .all(`%repos/${repoFullName}/pulls/%/files%`) as Array<{ body: string }>;
  }

  // Fallback if no full_name scoping produced rows
  if (rawFileRows.length === 0) {
    rawFileRows = db
      .prepare(
        `SELECT body FROM raw_responses
         WHERE provider = 'github' AND request_key LIKE '%/pulls/%/files%'
         ORDER BY id ASC`,
      )
      .all() as Array<{ body: string }>;
  }

  for (const row of rawFileRows) {
    try {
      const filesData = JSON.parse(row.body);
      if (!Array.isArray(filesData)) continue;

      for (const f of filesData) {
        const normFilename = normalizeFilePath(f.filename || '');
        if (!normFilename) continue;

        const status = String(f.status || 'modified').toLowerCase();

        if (status === 'renamed' && f.previous_filename) {
          const normPrev = normalizeFilePath(f.previous_filename);
          if (normPrev) {
            // Update any previous chain target pointing to normPrev
            for (const [orig, entry] of statusMap.entries()) {
              if (entry.currentPath === normPrev) {
                statusMap.set(orig, { currentPath: normFilename, isDeleted: false });
              }
            }
            statusMap.set(normPrev, { currentPath: normFilename, isDeleted: false });
          }
        }

        if (status === 'removed') {
          // Update any previous chain target pointing to normFilename
          for (const [orig, entry] of statusMap.entries()) {
            if (entry.currentPath === normFilename) {
              statusMap.set(orig, { currentPath: null, isDeleted: true });
            }
          }
          statusMap.set(normFilename, { currentPath: null, isDeleted: true });
        }
      }
    } catch {
      // Ignore malformed raw body
    }
  }

  return statusMap;
}

/**
 * Normalizes a raw string into a clean repository relative file path.
 * Returns null if the string is not a valid, safe repository path.
 */
export function normalizeFilePath(raw: string): string | null {
  if (!raw || typeof raw !== 'string') return null;

  let cleaned = raw.trim();

  // Strip leading/trailing markdown backticks, quotes, braces, brackets, parenthesis
  cleaned = cleaned.replace(/^[`'"]+|[`'"]+$/g, '');
  cleaned = cleaned.replace(/^[([{<]+|[)\]}>]+$/g, '');

  // Strip trailing line numbers, anchor references, or line:col numbers repeatedly
  cleaned = cleaned.replace(/:(?:\d+)(?::\d+)?$/g, '');
  cleaned = cleaned.replace(/#L?\d+(?:-L?\d+)?$/i, '');
  cleaned = cleaned.replace(/:L?\d+(?:-L?\d+)?$/i, '');

  // Strip trailing punctuation
  cleaned = cleaned.replace(/[.,:;!?]+$/g, '');

  // Normalize Windows backslashes to forward slashes
  cleaned = cleaned.replace(/\\/g, '/');

  // Strip leading './'
  cleaned = cleaned.replace(/^\.\//, '');

  // Reject URLs or URI schemes
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(cleaned)) {
    return null;
  }

  // Reject Windows drive letters / absolute paths (e.g. C:/ or d:/)
  if (/^[a-zA-Z]:[/]/.test(cleaned)) {
    return null;
  }

  // Reject directory traversal attempts, Unix absolute paths, or double slashes
  if (
    cleaned.startsWith('/') ||
    cleaned.includes('..') ||
    cleaned.includes('//') ||
    cleaned.includes('\0')
  ) {
    return null;
  }

  // Reject invalid filesystem characters (< > " | ? *)
  if (/[<>"|?*]/.test(cleaned)) {
    return null;
  }

  // Length limits
  if (cleaned.length < 3 || cleaned.length > 260) {
    return null;
  }

  // Reject purely numeric version numbers (e.g. 2.7, 3.11.2, 1.0.0)
  if (/^\d+(?:\.\d+)+$/.test(cleaned)) {
    return null;
  }

  const parts = cleaned.split('/');
  const filename = parts[parts.length - 1];

  // Must have a valid filename
  if (!filename) return null;

  const lowerFilename = filename.toLowerCase();

  // Check standalone filenames
  if (VALID_STANDALONE_FILENAMES.has(lowerFilename)) {
    return cleaned;
  }

  // Check extensions
  const dotIndex = filename.lastIndexOf('.');
  if (dotIndex > 0 && dotIndex < filename.length - 1) {
    const ext = filename.slice(dotIndex + 1).toLowerCase();
    if (VALID_FILE_EXTENSIONS.has(ext)) {
      return cleaned;
    }
  }

  // Reject conjunctions or English idioms (e.g. and/or, either/or).
  // Only accept extensionless files if they reside in recognized binary/script directories.
  const isKnownExecDir = ['bin/', 'scripts/', 'cmd/', 'tools/'].some((dir) =>
    cleaned.toLowerCase().startsWith(dir),
  );
  if (isKnownExecDir && parts.length >= 2 && /^[a-zA-Z0-9_\-.]+$/.test(filename)) {
    return cleaned;
  }

  return null;
}

/**
 * Extracts candidate repository file paths mentioned in a text block.
 */
export function extractFilePaths(text: string): string[] {
  if (!text || typeof text !== 'string') return [];

  const found = new Set<string>();

  // 1. Match backticked expressions: `path/to/file.ext`
  const backtickRegex = /`([^`\n\r]+)`/g;
  let match: RegExpExecArray | null;
  while ((match = backtickRegex.exec(text)) !== null) {
    const norm = normalizeFilePath(match[1]);
    if (norm) found.add(norm);
  }

  // 2. Tokenize by whitespace and punctuation delimiters
  const tokens = text.split(/[\s,;()[\]{}<>"']+/);
  for (const token of tokens) {
    const norm = normalizeFilePath(token);
    if (norm) found.add(norm);
  }

  return Array.from(found);
}

export class CodeMappingService {
  /**
   * Maps recovered decisions to repository files for a given decision.
   */
  public mapDecision(decisionId: number, customDb?: Database): { filesLinked: number } {
    const db = customDb || getDatabase();

    const decisionRow = db
      .prepare(
        `SELECT d.id, d.source_id, d.title, d.summary,
                s.repo_id, s.kind as source_kind, s.external_id as source_external_id,
                s.url as source_url, s.title as source_title, s.base_commit_sha,
                r.full_name as repo_full_name, r.clone_path
         FROM decisions d
         JOIN sources s ON d.source_id = s.id
         LEFT JOIN repositories r ON s.repo_id = r.id
         WHERE d.id = ?`,
      )
      .get(decisionId) as
      | {
          id: number;
          source_id: number;
          title: string;
          summary: string;
          repo_id: number;
          source_kind: string;
          source_external_id: string;
          source_url: string;
          source_title: string;
          base_commit_sha: string | null;
          repo_full_name: string | null;
          clone_path: string | null;
        }
      | undefined;

    if (!decisionRow) return { filesLinked: 0 };

    // Build or query repository file status map to resolve renames and deletions
    const statusMap = buildRepositoryFileStatusMap(decisionRow.repo_id, db, decisionRow.clone_path);

    const candidates: CandidateFileLink[] = [];

    // --- Candidate Source 1: Verified Evidence Quotes (Priority 4) ---
    const verifiedEvidenceRows = db
      .prepare(
        `SELECT id, quote, claim_type
         FROM evidence
         WHERE decision_id = ? AND verified = 1`,
      )
      .all(decisionId) as Array<{ id: number; quote: string; claim_type: string }>;

    for (const ev of verifiedEvidenceRows) {
      const paths = extractFilePaths(ev.quote);
      for (const p of paths) {
        const snippet = ev.quote.length > 60 ? `${ev.quote.slice(0, 57)}...` : ev.quote;
        const statusEntry = statusMap.get(p);
        const resolvedCurrent = statusEntry !== undefined ? statusEntry.currentPath : p;

        candidates.push({
          path: p,
          currentPath: resolvedCurrent,
          linkKind: 'mentioned',
          basis: `Directly referenced in verified evidence quote (${ev.claim_type}): "${snippet}"`,
          evidenceId: ev.id,
          commitSha: decisionRow.base_commit_sha,
          priority: 4,
        });
      }
    }

    // --- Candidate Source 2: PR Changed Files and Renames (Priority 3) ---
    if (decisionRow.source_kind === 'github_pr') {
      const extMatch = decisionRow.source_external_id.match(/^([^#]+)#(\d+)$/);
      const prNumber = extMatch
        ? extMatch[2]
        : decisionRow.source_external_id.match(/#(\d+)$/)?.[1] || '';
      const repoFullName = decisionRow.repo_full_name || (extMatch ? extMatch[1] : null);

      if (prNumber) {
        // Query cached PR files with strict repository scoping
        let rawFileRows: Array<{ body: string }> = [];
        if (repoFullName) {
          rawFileRows = db
            .prepare(
              `SELECT body FROM raw_responses
               WHERE provider = 'github' AND request_key LIKE ?`,
            )
            .all(`%repos/${repoFullName}/pulls/${prNumber}/files%`) as Array<{ body: string }>;
        }

        if (rawFileRows.length === 0) {
          rawFileRows = db
            .prepare(
              `SELECT body FROM raw_responses
               WHERE provider = 'github' AND request_key LIKE ?`,
            )
            .all(`%/pulls/${prNumber}/files%`) as Array<{ body: string }>;
        }

        for (const raw of rawFileRows) {
          try {
            const filesData = JSON.parse(raw.body);
            if (Array.isArray(filesData)) {
              for (const f of filesData) {
                const normFilename = normalizeFilePath(f.filename || '');
                if (!normFilename) continue;

                const status = String(f.status || 'modified').toLowerCase();
                const sha = f.sha || decisionRow.base_commit_sha || null;

                if (status === 'renamed' && f.previous_filename) {
                  const normPrev = normalizeFilePath(f.previous_filename);
                  if (normPrev) {
                    const statusEntry = statusMap.get(normFilename);
                    const targetCurrent =
                      statusEntry !== undefined ? statusEntry.currentPath : normFilename;

                    candidates.push({
                      path: normPrev,
                      currentPath: targetCurrent,
                      linkKind: 'rename_tracked',
                      basis: `Renamed from ${normPrev} to ${normFilename} in PR #${prNumber}`,
                      commitSha: sha,
                      priority: 3,
                    });
                  }
                }

                if (status === 'removed') {
                  candidates.push({
                    path: normFilename,
                    currentPath: null,
                    linkKind: 'pr_diff',
                    basis: `Removed in PR #${prNumber}: ${decisionRow.source_title}`,
                    commitSha: sha,
                    priority: 3,
                  });
                } else {
                  const statusEntry = statusMap.get(normFilename);
                  const targetCurrent =
                    statusEntry !== undefined ? statusEntry.currentPath : normFilename;

                  candidates.push({
                    path: normFilename,
                    currentPath: targetCurrent,
                    linkKind: 'pr_diff',
                    basis: `Modified in PR #${prNumber}: ${decisionRow.source_title}`,
                    commitSha: sha,
                    priority: 3,
                  });
                }
              }
            }
          } catch {
            // Ignore malformed raw body
          }
        }
      }
    }

    // --- Candidate Source 3: PR Review Comments (Priority 2) ---
    if (decisionRow.source_kind === 'github_pr') {
      const extMatch = decisionRow.source_external_id.match(/^([^#]+)#(\d+)$/);
      const prNumber = extMatch
        ? extMatch[2]
        : decisionRow.source_external_id.match(/#(\d+)$/)?.[1] || '';
      const repoFullName = decisionRow.repo_full_name || (extMatch ? extMatch[1] : null);

      if (prNumber) {
        let rawCommentRows: Array<{ body: string }> = [];
        if (repoFullName) {
          rawCommentRows = db
            .prepare(
              `SELECT body FROM raw_responses
               WHERE provider = 'github' AND request_key LIKE ?`,
            )
            .all(`%repos/${repoFullName}/pulls/${prNumber}/comments%`) as Array<{ body: string }>;
        }

        if (rawCommentRows.length === 0) {
          rawCommentRows = db
            .prepare(
              `SELECT body FROM raw_responses
               WHERE provider = 'github' AND request_key LIKE ?`,
            )
            .all(`%/pulls/${prNumber}/comments%`) as Array<{ body: string }>;
        }

        for (const raw of rawCommentRows) {
          try {
            const commentsData = JSON.parse(raw.body);
            if (Array.isArray(commentsData)) {
              for (const rc of commentsData) {
                if (rc.path) {
                  const normPath = normalizeFilePath(rc.path);
                  if (normPath) {
                    const author = rc.user?.login || 'reviewer';
                    const statusEntry = statusMap.get(normPath);
                    const targetCurrent =
                      statusEntry !== undefined ? statusEntry.currentPath : normPath;

                    candidates.push({
                      path: normPath,
                      currentPath: targetCurrent,
                      linkKind: 'pr_diff',
                      basis: `Target of code review comment by ${author} in PR #${prNumber}`,
                      commitSha: rc.commit_id || rc.original_commit_id || null,
                      priority: 2,
                    });
                  }
                }
              }
            }
          } catch {
            // Ignore malformed raw comments
          }
        }
      }
    }

    // --- Candidate Source 4: Discussion Comments tied to Decision Source (Priority 1) ---
    const commentRows = db
      .prepare(
        `SELECT id, author, body
         FROM comments
         WHERE source_id = ?`,
      )
      .all(decisionRow.source_id) as Array<{ id: number; author: string; body: string }>;

    for (const c of commentRows) {
      const paths = extractFilePaths(c.body);
      for (const p of paths) {
        const statusEntry = statusMap.get(p);
        const targetCurrent = statusEntry !== undefined ? statusEntry.currentPath : p;

        candidates.push({
          path: p,
          currentPath: targetCurrent,
          linkKind: 'mentioned',
          basis: `Referenced in discussion comment by ${c.author}`,
          evidenceId: null,
          commitSha: decisionRow.base_commit_sha,
          priority: 1,
        });
      }
    }

    // Precedence deduplication: for each unique path, choose the candidate with highest priority
    const bestCandidatesByPath = new Map<string, CandidateFileLink>();

    for (const cand of candidates) {
      const existing = bestCandidatesByPath.get(cand.path);
      if (!existing) {
        bestCandidatesByPath.set(cand.path, cand);
      } else if (cand.priority > existing.priority) {
        bestCandidatesByPath.set(cand.path, cand);
      } else if (cand.priority === existing.priority) {
        // Tie-breaker: prefer candidate with evidenceId or commitSha
        if (!existing.evidenceId && cand.evidenceId) {
          bestCandidatesByPath.set(cand.path, cand);
        } else if (!existing.commitSha && cand.commitSha) {
          bestCandidatesByPath.set(cand.path, cand);
        }
      }
    }

    // Atomic SQLite persistence with idempotency & precedence against existing rows
    const selectExistingStmt = db.prepare(
      `SELECT id, path, current_path, link_kind, basis, evidence_id, commit_sha
       FROM decision_files
       WHERE decision_id = ? AND path = ?`,
    );

    const insertStmt = db.prepare(
      `INSERT INTO decision_files (decision_id, path, current_path, link_kind, basis, evidence_id, commit_sha, symbol_name)
       VALUES (?, ?, ?, ?, ?, ?, ?, NULL)`,
    );

    const updateStmt = db.prepare(
      `UPDATE decision_files
       SET current_path = ?, link_kind = ?, basis = ?, evidence_id = ?, commit_sha = ?
       WHERE id = ?`,
    );

    const updateCurrentPathStmt = db.prepare(
      `UPDATE decision_files
       SET current_path = ?
       WHERE id = ?`,
    );

    const priorityWeight: Record<DecisionFileLinkKind, number> = {
      mentioned: 1,
      pr_diff: 3,
      rename_tracked: 3,
      symbol: 2,
    };

    let filesLinked = 0;

    const runTransaction = db.transaction(() => {
      for (const [filePath, candidate] of bestCandidatesByPath.entries()) {
        const existingRow = selectExistingStmt.get(decisionId, filePath) as
          | {
              id: number;
              path: string;
              current_path: string | null;
              link_kind: DecisionFileLinkKind;
              basis: string;
              evidence_id: number | null;
              commit_sha: string | null;
            }
          | undefined;

        if (!existingRow) {
          insertStmt.run(
            decisionId,
            filePath,
            candidate.currentPath,
            candidate.linkKind,
            candidate.basis,
            candidate.evidenceId || null,
            candidate.commitSha || null,
          );
          filesLinked++;
        } else {
          // Compare precedence: do not overwrite strong existing link with a weaker inferred one
          const existingPriority =
            existingRow.evidence_id !== null ? 4 : priorityWeight[existingRow.link_kind] || 1;

          if (candidate.priority > existingPriority) {
            updateStmt.run(
              candidate.currentPath,
              candidate.linkKind,
              candidate.basis,
              candidate.evidenceId || null,
              candidate.commitSha || null,
              existingRow.id,
            );
            filesLinked++;
          } else if (
            candidate.currentPath !== existingRow.current_path &&
            candidate.currentPath !== undefined
          ) {
            // Keep current_path synchronized with updated rename / deletion knowledge
            updateCurrentPathStmt.run(candidate.currentPath, existingRow.id);
          }
        }
      }
    });

    runTransaction();

    return { filesLinked };
  }

  /**
   * Maps decisions for an entire repository.
   */
  public mapDecisionsForRepository(
    repoId: number,
    customDb?: Database,
  ): { decisionsMapped: number; filesLinked: number } {
    const db = customDb || getDatabase();

    const decisionRows = db
      .prepare(
        `SELECT d.id
         FROM decisions d
         JOIN sources s ON d.source_id = s.id
         WHERE s.repo_id = ?`,
      )
      .all(repoId) as Array<{ id: number }>;

    let totalLinked = 0;
    for (const row of decisionRows) {
      const res = this.mapDecision(row.id, db);
      totalLinked += res.filesLinked;
    }

    return { decisionsMapped: decisionRows.length, filesLinked: totalLinked };
  }

  /**
   * Maps decisions for a given set of source IDs.
   */
  public mapDecisionsForSources(
    sourceIds: number[],
    customDb?: Database,
  ): { decisionsMapped: number; filesLinked: number } {
    if (!sourceIds.length) return { decisionsMapped: 0, filesLinked: 0 };

    const db = customDb || getDatabase();
    const placeholders = sourceIds.map(() => '?').join(',');

    const decisionRows = db
      .prepare(
        `SELECT id FROM decisions
         WHERE source_id IN (${placeholders})`,
      )
      .all(...sourceIds) as Array<{ id: number }>;

    let totalLinked = 0;
    for (const row of decisionRows) {
      const res = this.mapDecision(row.id, db);
      totalLinked += res.filesLinked;
    }

    return { decisionsMapped: decisionRows.length, filesLinked: totalLinked };
  }

  /**
   * Retrieves all files associated with a given decision.
   */
  public getFilesForDecision(decisionId: number, customDb?: Database): DecisionFile[] {
    const db = customDb || getDatabase();

    const rows = db
      .prepare(
        `SELECT path, current_path, link_kind, basis, commit_sha, evidence_id
         FROM decision_files
         WHERE decision_id = ?
         ORDER BY path ASC`,
      )
      .all(decisionId) as Array<{
      path: string;
      current_path: string | null;
      link_kind: DecisionFileLinkKind;
      basis: string;
      commit_sha: string | null;
      evidence_id: number | null;
    }>;

    return rows.map((r) => ({
      path: r.path,
      currentPath: r.current_path,
      linkKind: r.link_kind,
      basis: r.basis,
      commitSha: r.commit_sha,
      evidenceId: r.evidence_id,
    }));
  }

  /**
   * Queries decisions associated with a repository file (`GET /api/code/why`).
   */
  public getDecisionsForFile(
    filePath: string,
    repoId?: number,
    customDb?: Database,
  ): CodeWhyResponse {
    const db = customDb || getDatabase();
    const normalized = normalizeFilePath(filePath) || filePath.trim();

    const params: (string | number)[] = [normalized, normalized];
    let repoFilter = '';

    if (repoId !== undefined) {
      repoFilter = 'AND s.repo_id = ?';
      params.push(repoId);
    }

    const rows = db
      .prepare(
        `SELECT DISTINCT
           d.id, d.title, d.status, d.lifecycle, d.summary, d.confidence,
           s.url as sourceUrl, s.title as sourceTitle,
           df.path as file_path, df.current_path as file_current_path,
           df.link_kind as file_link_kind, df.basis as file_basis, df.commit_sha as file_commit_sha,
           df.evidence_id as file_evidence_id
         FROM decision_files df
         JOIN decisions d ON df.decision_id = d.id
         JOIN sources s ON d.source_id = s.id
         WHERE (df.path = ? OR df.current_path = ?)
         ${repoFilter}
         ORDER BY d.id DESC`,
      )
      .all(...params) as Array<{
      id: number;
      title: string;
      status: any;
      lifecycle: any;
      summary: string;
      confidence: number;
      sourceUrl: string;
      sourceTitle: string;
      file_path: string;
      file_current_path: string | null;
      file_link_kind: DecisionFileLinkKind;
      file_basis: string;
      file_commit_sha: string | null;
      file_evidence_id: number | null;
    }>;

    // Check evidence verification ratio for decision cards
    const evRatioStmt = db.prepare(
      `SELECT SUM(CASE WHEN verified = 1 THEN 1 ELSE 0 END) as vCount, COUNT(*) as tCount
       FROM evidence WHERE decision_id = ?`,
    );

    const decisionsMap = new Map<number, DecisionCard>();
    const links: DecisionFile[] = [];
    let resolvedCurrentPath: string | null = null;

    for (const r of rows) {
      if (!decisionsMap.has(r.id)) {
        const stats = evRatioStmt.get(r.id) as { vCount: number; tCount: number } | undefined;
        const vCount = stats?.vCount || 0;
        const tCount = stats?.tCount || 0;
        const verifiedRatio = tCount > 0 ? Math.round((vCount / tCount) * 100) / 100 : 0;

        decisionsMap.set(r.id, {
          id: r.id,
          title: r.title,
          status: r.status,
          lifecycle: r.lifecycle,
          summary: r.summary,
          confidence: r.confidence,
          sourceUrl: r.sourceUrl,
          sourceTitle: r.sourceTitle,
          verifiedRatio,
        });
      }

      links.push({
        path: r.file_path,
        currentPath: r.file_current_path,
        linkKind: r.file_link_kind,
        basis: r.file_basis,
        commitSha: r.file_commit_sha,
        evidenceId: r.file_evidence_id,
      });

      if (r.file_current_path) {
        resolvedCurrentPath = r.file_current_path;
      }
    }

    return {
      path: normalized,
      currentPath: resolvedCurrentPath,
      decisions: Array.from(decisionsMap.values()),
      links,
    };
  }

  /**
   * Returns distinct code tree nodes with decision counts (`GET /api/code/tree`).
   */
  public getCodeTree(repoId?: number, customDb?: Database): CodeTreeNode[] {
    const db = customDb || getDatabase();

    let repoFilter = '';
    const params: number[] = [];

    if (repoId !== undefined) {
      repoFilter = 'WHERE s.repo_id = ?';
      params.push(repoId);
    }

    const rows = db
      .prepare(
        `SELECT df.path, df.current_path, COUNT(DISTINCT df.decision_id) as decision_count
         FROM decision_files df
         JOIN decisions d ON df.decision_id = d.id
         JOIN sources s ON d.source_id = s.id
         ${repoFilter}
         GROUP BY df.path
         ORDER BY decision_count DESC, df.path ASC`,
      )
      .all(...params) as Array<{
      path: string;
      current_path: string | null;
      decision_count: number;
    }>;

    return rows.map((r) => ({
      path: r.path,
      currentPath: r.current_path,
      decisionCount: r.decision_count,
    }));
  }
}

export const codeMappingService = new CodeMappingService();
