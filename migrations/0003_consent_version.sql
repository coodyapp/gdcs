-- Which privacy policy version the subscriber agreed to.
ALTER TABLE subscribers ADD COLUMN consent_version TEXT NOT NULL DEFAULT '2026-11-02';
