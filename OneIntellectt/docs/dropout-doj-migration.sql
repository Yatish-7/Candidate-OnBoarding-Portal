-- Drop out / back out status, the new trail action DROP_OUT, and the two-approval columns:
--   * the DOJ is approved by the Sales Lead / Manager AND HR (doj_lead_approved, doj_hr_approved)
--   * the project end date is approved by the Sales Lead / Manager AND HR (project_end_lead_approved, project_end_hr_approved)
-- The app now runs with spring.jpa.hibernate.ddl-auto=validate, so it will NOT start until these columns exist.
-- Run once per database BEFORE deploying this version. Safe to run twice.
-- 1. the new columns (candidates, and its Envers history table)
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS doj_lead_approved boolean NOT NULL DEFAULT false;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS doj_hr_approved boolean NOT NULL DEFAULT false;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS project_end_lead_approved boolean NOT NULL DEFAULT false;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS project_end_hr_approved boolean NOT NULL DEFAULT false;
ALTER TABLE candidates_aud ADD COLUMN IF NOT EXISTS doj_lead_approved boolean;
ALTER TABLE candidates_aud ADD COLUMN IF NOT EXISTS doj_hr_approved boolean;
ALTER TABLE candidates_aud ADD COLUMN IF NOT EXISTS project_end_lead_approved boolean;
ALTER TABLE candidates_aud ADD COLUMN IF NOT EXISTS project_end_hr_approved boolean;

-- Candidates whose DOJ was already fully approved before this change count as approved on both sides
UPDATE candidates SET doj_lead_approved = true, doj_hr_approved = true WHERE doj_status = 'APPROVED';
UPDATE candidates SET project_end_lead_approved = true, project_end_hr_approved = true WHERE project_end_status = 'APPROVED';

-- 2. the new status and trail action
ALTER TABLE candidates DROP CONSTRAINT IF EXISTS candidates_status_check;
ALTER TABLE candidates ADD CONSTRAINT candidates_status_check CHECK (status IN
  ('PENDING_SALES_LEAD_APPROVAL','SALES_LEAD_DECLINED','IN_HR_CONTRACTS_REVIEW','IN_PAYROLL_ACCOUNTS_REVIEW',
   'RETURNED_TO_SALES_LEAD','COMPLETED','DROPPED_OUT','OVERRIDE_APPROVED','OVERRIDE_REJECTED'));
ALTER TABLE candidates_aud DROP CONSTRAINT IF EXISTS candidates_aud_status_check;
ALTER TABLE candidates_aud ADD CONSTRAINT candidates_aud_status_check CHECK (status IN
  ('PENDING_SALES_LEAD_APPROVAL','SALES_LEAD_DECLINED','IN_HR_CONTRACTS_REVIEW','IN_PAYROLL_ACCOUNTS_REVIEW',
   'RETURNED_TO_SALES_LEAD','COMPLETED','DROPPED_OUT','OVERRIDE_APPROVED','OVERRIDE_REJECTED'));
ALTER TABLE approval_actions DROP CONSTRAINT IF EXISTS approval_actions_action_type_check;
ALTER TABLE approval_actions ADD CONSTRAINT approval_actions_action_type_check CHECK (action_type IN
  ('SUBMIT','APPROVE','DECLINE','APPROVE_DOJ','SET_PROJECT_END','RAISE_PROJECT_END','APPROVE_PROJECT_END',
   'DECLINE_PROJECT_END','RATE_CHANGE','EDIT','DROP_OUT','OVERRIDE_APPROVE','OVERRIDE_DECLINE'));
ALTER TABLE approval_actions_aud DROP CONSTRAINT IF EXISTS approval_actions_aud_action_type_check;
ALTER TABLE approval_actions_aud ADD CONSTRAINT approval_actions_aud_action_type_check CHECK (action_type IN
  ('SUBMIT','APPROVE','DECLINE','APPROVE_DOJ','SET_PROJECT_END','RAISE_PROJECT_END','APPROVE_PROJECT_END',
   'DECLINE_PROJECT_END','RATE_CHANGE','EDIT','DROP_OUT','OVERRIDE_APPROVE','OVERRIDE_DECLINE'));
