import fs from 'node:fs';
import path from 'node:path';
import type { Database } from 'better-sqlite3';
import { getDatabase } from '../db/index.js';
import type {
  RadarResponse,
  RadarItem,
  Condition,
  ConditionHealth,
} from '@decisionvault/shared/api';
import { RadarResponseSchema } from '@decisionvault/shared/api';
import type { HealthState, ProbeType } from '@decisionvault/shared/enums';

export class RadarService {
  /**
   * Evaluates a deterministic probe against a repository clone path or manifests.
   */
  public evaluateProbe(
    probe: ProbeType,
    probeValue: string | null,
    clonePath: string | null,
  ): {
    state: HealthState;
    signalType?: string;
    signalPath?: string;
    signalValue?: string;
    details?: string;
    interpretation?: string;
  } {
    if (probe === 'none' || !probeValue) {
      return {
        state: 'holds',
        signalType: 'none',
        details: 'Constraint relies on standard technical rationale without automated probe.',
      };
    }

    if (!clonePath || !fs.existsSync(clonePath)) {
      return {
        state: 'holds',
        signalType: probe,
        details: 'Repository clone not available locally; assuming condition holds.',
      };
    }

    try {
      // 1. Python Requires Probe (e.g. requires-python in pyproject.toml / setup.cfg)
      if (probe === 'python_requires') {
        const pyproject = path.join(clonePath, 'pyproject.toml');
        const setupCfg = path.join(clonePath, 'setup.cfg');

        let content = '';
        let manifestPath = '';
        if (fs.existsSync(pyproject)) {
          content = fs.readFileSync(pyproject, 'utf8');
          manifestPath = 'pyproject.toml';
        } else if (fs.existsSync(setupCfg)) {
          content = fs.readFileSync(setupCfg, 'utf8');
          manifestPath = 'setup.cfg';
        }

        if (content) {
          const reqMatch = content.match(/requires-python\s*=\s*["']([^"']+)["']/i);
          if (reqMatch) {
            const actualVal = reqMatch[1];
            // If condition was Python 2.7 or < 3.8 and current requires >= 3.8 or 3.10+
            if (
              (probeValue.includes('2.7') || probeValue.includes('3.6')) &&
              (actualVal.includes('3.8') ||
                actualVal.includes('3.9') ||
                actualVal.includes('3.10') ||
                actualVal.includes('3.11') ||
                actualVal.includes('3.12'))
            ) {
              return {
                state: 'may_not_hold',
                signalType: 'python_requires',
                signalPath: manifestPath,
                signalValue: actualVal,
                details: `Manifest specifies requires-python = "${actualVal}"; legacy constraint "${probeValue}" dropped.`,
                interpretation:
                  'This historical rejection may deserve reconsideration because the original constraint appears to have changed.',
              };
            }
          }
        }
      }

      // 2. Node Engines Probe (e.g. package.json engines)
      if (probe === 'node_engines') {
        const pkgJson = path.join(clonePath, 'package.json');
        if (fs.existsSync(pkgJson)) {
          try {
            const pkg = JSON.parse(fs.readFileSync(pkgJson, 'utf8'));
            const nodeEngine = pkg.engines?.node;
            if (nodeEngine && typeof nodeEngine === 'string') {
              if (probeValue.includes('14') && !nodeEngine.includes('14')) {
                return {
                  state: 'may_not_hold',
                  signalType: 'node_engines',
                  signalPath: 'package.json',
                  signalValue: nodeEngine,
                  details: `Node engine requirement is "${nodeEngine}"; constraint "${probeValue}" no longer enforced.`,
                  interpretation:
                    'This historical rejection may deserve reconsideration because the original constraint appears to have changed.',
                };
              }
            }
          } catch {
            // Ignore parse error
          }
        }
      }

      // 3. Dependency Present Probe
      if (probe === 'dependency_present') {
        const pyproject = path.join(clonePath, 'pyproject.toml');
        const reqTxt = path.join(clonePath, 'requirements.txt');
        const pkgJson = path.join(clonePath, 'package.json');

        const depName = probeValue.toLowerCase();
        let foundIn = '';
        if (
          fs.existsSync(pyproject) &&
          fs.readFileSync(pyproject, 'utf8').toLowerCase().includes(depName)
        ) {
          foundIn = 'pyproject.toml';
        } else if (
          fs.existsSync(reqTxt) &&
          fs.readFileSync(reqTxt, 'utf8').toLowerCase().includes(depName)
        ) {
          foundIn = 'requirements.txt';
        } else if (
          fs.existsSync(pkgJson) &&
          fs.readFileSync(pkgJson, 'utf8').toLowerCase().includes(depName)
        ) {
          foundIn = 'package.json';
        }

        if (foundIn) {
          return {
            state: 'may_not_hold',
            signalType: 'dependency_present',
            signalPath: foundIn,
            signalValue: probeValue,
            details: `Dependency "${probeValue}" is now present in ${foundIn}; original lack of dependency may no longer hold.`,
            interpretation:
              'This historical rejection may deserve reconsideration because the original constraint appears to have changed.',
          };
        }
      }

      // 4. CI Matrix Probe (.github/workflows)
      if (probe === 'ci_python_matrix') {
        const workflowsDir = path.join(clonePath, '.github', 'workflows');
        if (fs.existsSync(workflowsDir)) {
          const files = fs.readdirSync(workflowsDir);
          for (const file of files) {
            const filePath = path.join(workflowsDir, file);
            if (fs.statSync(filePath).isFile()) {
              const content = fs.readFileSync(filePath, 'utf8');
              if (content.includes('python-version') && !content.includes(probeValue)) {
                return {
                  state: 'may_not_hold',
                  signalType: 'ci_python_matrix',
                  signalPath: `.github/workflows/${file}`,
                  signalValue: 'modern python matrix',
                  details: `CI workflow does not test legacy version "${probeValue}".`,
                  interpretation:
                    'This historical rejection may deserve reconsideration because the original constraint appears to have changed.',
                };
              }
            }
          }
        }
      }
    } catch {
      // Non-fatal fallback
    }

    return {
      state: 'holds',
      signalType: probe,
      details: 'Probe evaluated and constraint currently holds.',
    };
  }

  /**
   * Rechecks health of conditions and writes results to the health table.
   */
  public recheckHealth(
    options: { repoId?: number; decisionId?: number },
    customDb?: Database,
  ): { rechecked: number } {
    const db = customDb || getDatabase();

    const conditionsFilter: string[] = [];
    const params: number[] = [];

    if (options.decisionId !== undefined) {
      conditionsFilter.push('d.id = ?');
      params.push(options.decisionId);
    }

    if (options.repoId !== undefined) {
      conditionsFilter.push('s.repo_id = ?');
      params.push(options.repoId);
    }

    const whereClause =
      conditionsFilter.length > 0 ? `WHERE ${conditionsFilter.join(' AND ')}` : '';

    const conditionRows = db
      .prepare(
        `SELECT c.id as condition_id, c.text, c.kind, c.probe, c.probe_value,
                r.clone_path
         FROM conditions c
         JOIN alternatives a ON c.alternative_id = a.id
         JOIN decisions d ON a.decision_id = d.id
         JOIN sources s ON d.source_id = s.id
         LEFT JOIN repositories r ON s.repo_id = r.id
         ${whereClause}`,
      )
      .all(...params) as Array<{
      condition_id: number;
      text: string;
      kind: any;
      probe: ProbeType;
      probe_value: string | null;
      clone_path: string | null;
    }>;

    const insertHealthStmt = db.prepare(
      `INSERT INTO health (condition_id, run_id, state, signal_type, signal_path, signal_value, details, interpretation, checked_at)
       VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?)`,
    );

    const updateConditionStmt = db.prepare(
      `UPDATE conditions SET last_checked_at = ? WHERE id = ?`,
    );

    const now = new Date().toISOString();

    const tx = db.transaction(() => {
      for (const row of conditionRows) {
        const probeResult = this.evaluateProbe(row.probe, row.probe_value, row.clone_path);
        insertHealthStmt.run(
          row.condition_id,
          probeResult.state,
          probeResult.signalType || null,
          probeResult.signalPath || null,
          probeResult.signalValue || null,
          probeResult.details || null,
          probeResult.interpretation || null,
          now,
        );
        updateConditionStmt.run(now, row.condition_id);
      }
    });

    tx();

    return { rechecked: conditionRows.length };
  }

  /**
   * Queries conditions and their latest health status for Reopen Radar (`GET /api/radar`).
   */
  public getRadarItems(
    options: { repoId?: number; state?: HealthState },
    customDb?: Database,
  ): RadarResponse {
    const db = customDb || getDatabase();

    const filters: string[] = [];
    const params: any[] = [];

    if (options.repoId !== undefined) {
      filters.push('s.repo_id = ?');
      params.push(options.repoId);
    }

    if (options.state !== undefined) {
      filters.push('h.state = ?');
      params.push(options.state);
    }

    const whereClause = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';

    const rows = db
      .prepare(
        `SELECT d.id as decision_id, d.title,
                a.name as alternative_name,
                c.id as condition_id, c.text as condition_text, c.kind as condition_kind,
                c.probe as condition_probe, c.probe_value as condition_probe_value,
                h.id as health_id, h.state as health_state, h.signal_type, h.signal_path,
                h.signal_value, h.details, h.interpretation, h.checked_at
         FROM conditions c
         JOIN alternatives a ON c.alternative_id = a.id
         JOIN decisions d ON a.decision_id = d.id
         JOIN sources s ON d.source_id = s.id
         LEFT JOIN (
           SELECT h1.* FROM health h1
           JOIN (SELECT condition_id, MAX(id) as max_id FROM health GROUP BY condition_id) h2
             ON h1.id = h2.max_id
         ) h ON c.id = h.condition_id
         ${whereClause}
         ORDER BY (CASE WHEN h.state = 'may_not_hold' THEN 1 WHEN h.state = 'unknown' THEN 2 ELSE 3 END), c.id ASC`,
      )
      .all(...params) as Array<{
      decision_id: number;
      title: string;
      alternative_name: string;
      condition_id: number;
      condition_text: string;
      condition_kind: any;
      condition_probe: any;
      condition_probe_value: string | null;
      health_id: number | null;
      health_state: HealthState | null;
      signal_type: string | null;
      signal_path: string | null;
      signal_value: string | null;
      details: string | null;
      interpretation: string | null;
      checked_at: string | null;
    }>;

    const items: RadarItem[] = [];

    for (const r of rows) {
      let health: ConditionHealth | null = null;
      if (r.health_state && r.checked_at) {
        health = {
          state: r.health_state,
          signalType: r.signal_type || undefined,
          signalPath: r.signal_path || undefined,
          signalValue: r.signal_value || undefined,
          details: r.details || undefined,
          interpretation: r.interpretation || undefined,
          checkedAt: new Date(r.checked_at).toISOString(),
        };
      }

      const condition: Condition = {
        id: r.condition_id,
        text: r.condition_text,
        kind: r.condition_kind,
        probe: r.condition_probe,
        probeValue: r.condition_probe_value,
        health,
      };

      items.push({
        decisionId: r.decision_id,
        title: r.title,
        alternativeName: r.alternative_name,
        condition,
        health,
      });
    }

    return RadarResponseSchema.parse({ items });
  }
}

export const radarService = new RadarService();
