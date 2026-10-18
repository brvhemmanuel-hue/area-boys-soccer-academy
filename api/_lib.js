import { neon } from '@neondatabase/serverless';
import crypto from 'node:crypto';

export const sql = neon(process.env.DATABASE_URL);

// --- Minimal signed-token auth (admin only) ---
const mac = (p) => crypto.createHmac('sha256', process.env.AUTH_SECRET || '').update(p).digest('base64url');
export function sign() {
  const p = Buffer.from(JSON.stringify({ exp: Date.now() + 12 * 3600e3 })).toString('base64url');
  return `${p}.${mac(p)}`;
}
export function verify(token) {
  if (!token || !process.env.AUTH_SECRET) return false;
  const [p, s] = token.split('.');
  if (!p || !s) return false;
  const e = mac(p);
  if (s.length !== e.length || !crypto.timingSafeEqual(Buffer.from(s), Buffer.from(e))) return false;
  try { return JSON.parse(Buffer.from(p, 'base64url').toString()).exp > Date.now(); } catch { return false; }
}

// --- Tables are created automatically on first request ---
let ready;
export function ensureSchema() {
  ready ||= (async () => {
    await sql`CREATE TABLE IF NOT EXISTS members (
      id SERIAL PRIMARY KEY, full_name TEXT NOT NULL, phone TEXT, email TEXT, position TEXT,
      jersey_no INT, status TEXT DEFAULT 'active', joined_on DATE DEFAULT CURRENT_DATE, notes TEXT,
      created_at TIMESTAMPTZ DEFAULT now())`;
    await sql`CREATE TABLE IF NOT EXISTS activities (
      id SERIAL PRIMARY KEY, title TEXT NOT NULL, type TEXT DEFAULT 'Event',
      activity_date DATE DEFAULT CURRENT_DATE, target_amount NUMERIC(12,2) DEFAULT 0, description TEXT)`;
    await sql`CREATE TABLE IF NOT EXISTS contributions (
      id SERIAL PRIMARY KEY, member_id INT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
      activity_id INT REFERENCES activities(id) ON DELETE SET NULL, amount NUMERIC(12,2) NOT NULL,
      method TEXT DEFAULT 'Cash', paid_on DATE DEFAULT CURRENT_DATE, note TEXT)`;
    await sql`CREATE TABLE IF NOT EXISTS matches (
      id SERIAL PRIMARY KEY, opponent TEXT NOT NULL, match_date DATE NOT NULL, venue TEXT,
      home_away TEXT DEFAULT 'Home', goals_for INT, goals_against INT, status TEXT DEFAULT 'Scheduled')`;
    await sql`CREATE TABLE IF NOT EXISTS expenses (
      id SERIAL PRIMARY KEY, title TEXT NOT NULL, category TEXT DEFAULT 'General',
      amount NUMERIC(12,2) NOT NULL, spent_on DATE DEFAULT CURRENT_DATE, note TEXT)`;
  })().catch((e) => { ready = null; throw e; });
  return ready;
}
