-- Payroll and Accounts now approve/decline after HR and Contracts both approve.
-- ddl-auto=update adds candidates.payroll_decision / accounts_decision (default PENDING) by itself
-- but does not touch CHECK constraints. Run once per database BEFORE using the new flow.
ALTER TABLE candidates DROP CONSTRAINT IF EXISTS candidates_status_check;
ALTER TABLE candidates ADD CONSTRAINT candidates_status_check CHECK (status IN
  ('PENDING_SALES_LEAD_APPROVAL','SALES_LEAD_DECLINED','IN_HR_CONTRACTS_REVIEW','IN_PAYROLL_ACCOUNTS_REVIEW',
   'RETURNED_TO_SALES_LEAD','COMPLETED','OVERRIDE_APPROVED','OVERRIDE_REJECTED'));
ALTER TABLE candidates_aud DROP CONSTRAINT IF EXISTS candidates_aud_status_check;
ALTER TABLE candidates_aud ADD CONSTRAINT candidates_aud_status_check CHECK (status IN
  ('PENDING_SALES_LEAD_APPROVAL','SALES_LEAD_DECLINED','IN_HR_CONTRACTS_REVIEW','IN_PAYROLL_ACCOUNTS_REVIEW',
   'RETURNED_TO_SALES_LEAD','COMPLETED','OVERRIDE_APPROVED','OVERRIDE_REJECTED'));
ALTER TABLE approval_actions DROP CONSTRAINT IF EXISTS approval_actions_stage_check;
ALTER TABLE approval_actions ADD CONSTRAINT approval_actions_stage_check CHECK (stage IN
  ('RECRUITER','SALES_LEAD','HR','CONTRACTS','PAYROLL','ACCOUNTS','DOJ','SUPER_ADMIN'));
ALTER TABLE approval_actions_aud DROP CONSTRAINT IF EXISTS approval_actions_aud_stage_check;
ALTER TABLE approval_actions_aud ADD CONSTRAINT approval_actions_aud_stage_check CHECK (stage IN
  ('RECRUITER','SALES_LEAD','HR','CONTRACTS','PAYROLL','ACCOUNTS','DOJ','SUPER_ADMIN'));
