import DatabaseConstructor, { Database as DatabaseType } from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let globalDb: DatabaseType | null = null;

export function getSchemaSql(): string {
  const schemaPath = path.resolve(__dirname, 'schema.sql');
  if (fs.existsSync(schemaPath)) {
    return fs.readFileSync(schemaPath, 'utf8');
  }
  const fallbackPath = path.resolve(__dirname, '../../db/schema.sql');
  if (fs.existsSync(fallbackPath)) {
    return fs.readFileSync(fallbackPath, 'utf8');
  }
  const rootPath = path.resolve(process.cwd(), 'server/db/schema.sql');
  if (fs.existsSync(rootPath)) {
    return fs.readFileSync(rootPath, 'utf8');
  }
  return fs.readFileSync(schemaPath, 'utf8');
}

export function initDatabase(dbPath?: string): DatabaseType {
  const resolvedPath = dbPath || process.env.DB_PATH || ':memory:';

  // Ensure parent directory exists if using a file path
  if (resolvedPath !== ':memory:') {
    const dir = path.dirname(path.resolve(resolvedPath));
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  const db = new DatabaseConstructor(resolvedPath);

  // Foreign keys must be enabled on every connection
  db.pragma('foreign_keys = ON');

  // Execute the full schema idempotently
  const schemaSql = getSchemaSql();
  db.exec(schemaSql);

  globalDb = db;
  return db;
}

export function getDatabase(): DatabaseType {
  if (!globalDb) {
    return initDatabase();
  }
  return globalDb;
}

export function closeDatabase(): void {
  if (globalDb) {
    globalDb.close();
    globalDb = null;
  }
}
