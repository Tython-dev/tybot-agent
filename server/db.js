import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, 'data.sqlite');

sqlite3.verbose();
export const db = new sqlite3.Database(dbPath);

export function initDb() {
  db.serialize(() => {
    db.run(
      `CREATE TABLE IF NOT EXISTS agents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        instruction TEXT NOT NULL,
        mode TEXT DEFAULT 'plan',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`
    );

    // Add mode column if missing
    db.all('PRAGMA table_info(agents)', (err, rows) => {
      if (err) return;
      const hasMode = rows?.some(r => r.name === 'mode');
      if (!hasMode) {
        db.run('ALTER TABLE agents ADD COLUMN mode TEXT DEFAULT "plan"', () => {});
      }
    });

    db.run(
      `CREATE TABLE IF NOT EXISTS logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        agent_id INTEGER NOT NULL,
        output TEXT NOT NULL,
        type TEXT CHECK(type IN ('stdout','stderr')) NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(agent_id) REFERENCES agents(id)
      )`
    );

    // Add executions table to track runs
    db.run(
      `CREATE TABLE IF NOT EXISTS executions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        agent_id INTEGER NOT NULL,
        pid INTEGER,
        status TEXT,
        exit_code INTEGER,
        started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        ended_at DATETIME,
        FOREIGN KEY(agent_id) REFERENCES agents(id)
      )`
    );

    // Conditionally add execution_id column to logs if missing
    db.all('PRAGMA table_info(logs)', (err, rows) => {
      if (err) return;
      const hasExecId = rows?.some(r => r.name === 'execution_id');
      if (!hasExecId) {
        db.run('ALTER TABLE logs ADD COLUMN execution_id INTEGER', () => {});
      }
    });
  });
}
