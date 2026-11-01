-- Per-address throttle for confirmation emails (anti email-bombing).
ALTER TABLE subscribers ADD COLUMN last_confirm_sent_at TEXT;
ALTER TABLE subscribers ADD COLUMN confirm_sends INTEGER NOT NULL DEFAULT 0;
