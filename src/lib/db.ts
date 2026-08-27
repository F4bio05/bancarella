import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";

/**
 * SQLite locale tramite il modulo nativo `node:sqlite` (Node >= 22):
 * nessuna dipendenza da compilare, il database e' un singolo file su disco.
 */

const DATA_DIR = process.env.DATA_DIR ?? path.join(process.cwd(), "data");
const DB_FILE = process.env.DB_FILE ?? path.join(DATA_DIR, "bancarella.db");

const SCHEMA = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT    NOT NULL,
  email_lower   TEXT    NOT NULL UNIQUE,
  name          TEXT    NOT NULL,
  password_hash TEXT    NOT NULL,
  created_at    TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token      TEXT    PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT    NOT NULL,
  expires_at TEXT    NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS people (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       TEXT    NOT NULL,
  name_lower TEXT    NOT NULL,
  phone      TEXT,
  note       TEXT,
  archived   INTEGER NOT NULL DEFAULT 0,
  created_at TEXT    NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS people_user_name ON people(user_id, name_lower);

CREATE TABLE IF NOT EXISTS days (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day_date    TEXT    NOT NULL,
  label       TEXT,
  status      TEXT    NOT NULL DEFAULT 'open',
  opened_at   TEXT    NOT NULL,
  closed_at   TEXT,
  total_cents INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS days_user_status ON days(user_id, status, day_date);

CREATE TABLE IF NOT EXISTS day_participants (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  day_id      INTEGER NOT NULL REFERENCES days(id) ON DELETE CASCADE,
  person_id   INTEGER NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  person_name TEXT    NOT NULL,
  added_at    TEXT    NOT NULL,
  UNIQUE(day_id, person_id)
);

CREATE TABLE IF NOT EXISTS movements (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  day_id       INTEGER NOT NULL REFERENCES days(id) ON DELETE CASCADE,
  person_id    INTEGER NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  amount_cents INTEGER NOT NULL,
  note         TEXT,
  client_id    TEXT,
  created_at   TEXT    NOT NULL
);
CREATE INDEX IF NOT EXISTS movements_day ON movements(day_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS movements_client ON movements(day_id, client_id);
`;

type Global = typeof globalThis & { __bancarellaDb?: DatabaseSync };
const g = globalThis as Global;

function open(): DatabaseSync {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const db = new DatabaseSync(DB_FILE);
  db.exec(SCHEMA);
  return db;
}

/** Connessione condivisa (sopravvive all'hot-reload di Next in sviluppo). */
export function getDb(): DatabaseSync {
  if (!g.__bancarellaDb) g.__bancarellaDb = open();
  return g.__bancarellaDb;
}

export function nowIso(): string {
  return new Date().toISOString();
}

/** Esegue una funzione dentro una transazione. */
export function tx<T>(fn: () => T): T {
  const db = getDb();
  db.exec("BEGIN");
  try {
    const out = fn();
    db.exec("COMMIT");
    return out;
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}
