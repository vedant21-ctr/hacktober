/**
 * DecisionVault Standalone Demo Seeding Script
 *
 * Populates decisionvault.db with the fictional acme-inc/payment-service repository,
 * verified Evidence Lock quotes, code connections, timeline events, and radar conditions.
 *
 * Usage:
 *   npm run seed:demo
 */

import { initDatabase } from '../db/index.js';
import { demoService } from './service.js';

console.log('Seeding fictional demonstration repository (acme-inc/payment-service)...');

try {
  const db = initDatabase();
  const result = demoService.seedDemoRepository(db);

  if (result.ok) {
    const altCount = (db.prepare('SELECT COUNT(*) as c FROM alternatives').get() as { c: number })
      .c;
    const evCount = (
      db.prepare('SELECT COUNT(*) as c FROM evidence WHERE verified = 1').get() as { c: number }
    ).c;
    const fileCount = (
      db.prepare('SELECT COUNT(*) as c FROM decision_files').get() as { c: number }
    ).c;
    const condCount = (db.prepare('SELECT COUNT(*) as c FROM conditions').get() as { c: number }).c;
    const eventCount = (
      db.prepare('SELECT COUNT(*) as c FROM decision_events').get() as { c: number }
    ).c;
    const relCount = (
      db.prepare('SELECT COUNT(*) as c FROM decision_relationships').get() as { c: number }
    ).c;

    console.log(
      `\n✓ SUCCESS: Demo repository "${result.repoName}" (Repo #${result.repoId}) is ready!`,
    );
    console.log(`  - ${result.sourcesCount} Source discussions (Issues & PRs)`);
    console.log(`  - ${result.decisionsCount} Architectural decisions`);
    console.log(`  - ${altCount} Alternatives (chosen & rejected)`);
    console.log(`  - ${evCount} Verbatim Evidence Lock quotes (100% exact substring verified)`);
    console.log(`  - ${fileCount} Linked codebase files`);
    console.log(`  - ${eventCount} Chronological timeline events`);
    console.log(`  - ${relCount} Cross-decision relationships`);
    console.log(`  - ${condCount} Reopen Radar conditions monitored\n`);
    process.exit(0);
  } else {
    console.error('Failed to seed demo repository.');
    process.exit(1);
  }
} catch (err) {
  console.error('Error seeding demo repository:', err);
  process.exit(1);
}
