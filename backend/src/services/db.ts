import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const db = new Database(path.join(__dirname, "../../data/mezogenie.db"));

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    phone TEXT PRIMARY KEY,
    wallet TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS recipients (
    phone TEXT PRIMARY KEY,
    wallet TEXT,
    sender_phone TEXT,
    name TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    phone TEXT,
    type TEXT,
    threshold REAL,
    enabled INTEGER DEFAULT 1
  );
`);

export function getUser(phone: string) {
  return db.prepare("SELECT * FROM users WHERE phone = ?").get(phone) as { phone: string; wallet: string } | undefined;
}

export function upsertUser(phone: string, wallet: string) {
  db.prepare("INSERT OR REPLACE INTO users (phone, wallet) VALUES (?, ?)").run(phone, wallet);
}

export function getRecipient(phone: string) {
  return db.prepare("SELECT * FROM recipients WHERE phone = ?").get(phone) as { phone: string; wallet: string; sender_phone: string; name: string } | undefined;
}

export function upsertRecipient(phone: string, wallet: string, senderPhone: string, name?: string) {
  db.prepare("INSERT OR REPLACE INTO recipients (phone, wallet, sender_phone, name) VALUES (?, ?, ?, ?)").run(phone, wallet, senderPhone, name || null);
}

export function setAlert(phone: string, type: string, threshold: number) {
  db.prepare("INSERT INTO alerts (phone, type, threshold) VALUES (?, ?, ?)").run(phone, type, threshold);
}

export function getAlerts(phone: string) {
  return db.prepare("SELECT * FROM alerts WHERE phone = ? AND enabled = 1").all(phone) as { type: string; threshold: number }[];
}

export default db;
