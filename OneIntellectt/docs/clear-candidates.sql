-- Clears ALL candidate data and keeps users, teams and everything else.
-- Take a backup first:  pg_dump -U postgres -d Intellectt -f backup_before_clear.sql
-- Run:  psql -U postgres -d Intellectt -f docs/clear-candidates.sql
--
-- What goes:  candidates, and their approval trail (approval_actions).
-- What stays: users, teams, sessions, the audit history tables (*_aud, audit_revisions).
--             The audit tables are append-only by design (ISO 27001 evidence): don't delete from them.
BEGIN;

-- the trail points at candidates, so it goes first
DELETE FROM approval_actions;
DELETE FROM candidates;

-- OPTIONAL: start candidate ids from 1 again (skip this line to keep counting up)
-- ALTER TABLE candidates ALTER COLUMN id RESTART WITH 1;
-- ALTER TABLE approval_actions ALTER COLUMN id RESTART WITH 1;

COMMIT;

-- check: both should be 0, users unchanged
SELECT (SELECT count(*) FROM candidates)       AS candidates,
       (SELECT count(*) FROM approval_actions) AS approval_actions,
       (SELECT count(*) FROM users)            AS users,
       (SELECT count(*) FROM teams)            AS teams;
