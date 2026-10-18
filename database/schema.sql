-- Club Manager database schema (PostgreSQL / Neon)
-- Run this in the Neon dashboard > SQL Editor.
-- (Optional: the app also creates these tables automatically on first sign-in.)

CREATE TABLE IF NOT EXISTS members (
  id          SERIAL PRIMARY KEY,
  full_name   TEXT NOT NULL,
  phone       TEXT,
  email       TEXT,
  position    TEXT,
  jersey_no   INT,
  status      TEXT DEFAULT 'active',      -- active | injured | suspended | inactive
  joined_on   DATE DEFAULT CURRENT_DATE,
  notes       TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS activities (
  id             SERIAL PRIMARY KEY,
  title          TEXT NOT NULL,
  type           TEXT DEFAULT 'Event',
  activity_date  DATE DEFAULT CURRENT_DATE,
  target_amount  NUMERIC(12,2) DEFAULT 0,
  description    TEXT
);

CREATE TABLE IF NOT EXISTS contributions (
  id           SERIAL PRIMARY KEY,
  member_id    INT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  activity_id  INT REFERENCES activities(id) ON DELETE SET NULL,
  amount       NUMERIC(12,2) NOT NULL,
  method       TEXT DEFAULT 'Cash',
  paid_on      DATE DEFAULT CURRENT_DATE,
  note         TEXT
);

CREATE TABLE IF NOT EXISTS matches (
  id             SERIAL PRIMARY KEY,
  opponent       TEXT NOT NULL,
  match_date     DATE NOT NULL,
  venue          TEXT,
  home_away      TEXT DEFAULT 'Home',
  goals_for      INT,
  goals_against  INT,
  status         TEXT DEFAULT 'Scheduled'  -- Scheduled | Played | Postponed
);

CREATE TABLE IF NOT EXISTS expenses (
  id        SERIAL PRIMARY KEY,
  title     TEXT NOT NULL,
  category  TEXT DEFAULT 'General',
  amount    NUMERIC(12,2) NOT NULL,
  spent_on  DATE DEFAULT CURRENT_DATE,
  note      TEXT
);

CREATE INDEX IF NOT EXISTS idx_contrib_member   ON contributions(member_id);
CREATE INDEX IF NOT EXISTS idx_contrib_activity ON contributions(activity_id);
CREATE INDEX IF NOT EXISTS idx_contrib_paid_on  ON contributions(paid_on);
CREATE INDEX IF NOT EXISTS idx_matches_date     ON matches(match_date);
