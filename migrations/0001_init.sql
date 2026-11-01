-- Newsletter subscribers. Double opt-in: rows start 'pending' until the
-- confirmation link is used. Tokens are random, single-purpose, unguessable.
CREATE TABLE subscribers (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE CHECK(length(email) BETWEEN 3 AND 254),
  status TEXT NOT NULL CHECK(status IN ('pending', 'active', 'unsubscribed')),
  confirm_token TEXT NOT NULL UNIQUE,
  unsub_token TEXT NOT NULL UNIQUE,
  source TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  confirmed_at TEXT,
  unsubscribed_at TEXT
);
CREATE INDEX subscribers_status ON subscribers(status);

-- One row per digest send; the cursor for "what is new since last time".
CREATE TABLE sends (
  id TEXT PRIMARY KEY,
  sent_at TEXT NOT NULL,
  since TEXT NOT NULL,
  sheet_ids TEXT NOT NULL,
  recipients INTEGER NOT NULL
);

-- Per-IP write throttle (hashed IP, one-minute windows).
CREATE TABLE write_limits (
  ip_hash TEXT NOT NULL,
  window_start INTEGER NOT NULL,
  attempts INTEGER NOT NULL,
  PRIMARY KEY(ip_hash, window_start)
);

-- Aggregate counts only: no visitor identifiers.
CREATE TABLE site_events (
  day TEXT NOT NULL,
  name TEXT NOT NULL,
  path TEXT NOT NULL,
  count INTEGER NOT NULL,
  PRIMARY KEY(day, name, path)
);
