-- Sales Manager role + "declined by Sales Lead/Manager" status.
-- ddl-auto=update adds teams.sales_manager_id by itself but does not touch CHECK constraints.
-- Run once per database (Intellectt, intellectt_test, intellectt_load) BEFORE using the new role.
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN
  ('RECRUITER','SALES_LEAD','SALES_MANAGER','HR','CONTRACTS','PAYROLL','ACCOUNTS','ADMIN','SUPER_ADMIN'));
ALTER TABLE users_aud DROP CONSTRAINT IF EXISTS users_aud_role_check;
ALTER TABLE users_aud ADD CONSTRAINT users_aud_role_check CHECK (role IN
  ('RECRUITER','SALES_LEAD','SALES_MANAGER','HR','CONTRACTS','PAYROLL','ACCOUNTS','ADMIN','SUPER_ADMIN'));
ALTER TABLE approval_actions DROP CONSTRAINT IF EXISTS approval_actions_actor_role_check;
ALTER TABLE approval_actions ADD CONSTRAINT approval_actions_actor_role_check CHECK (actor_role IN
  ('RECRUITER','SALES_LEAD','SALES_MANAGER','HR','CONTRACTS','PAYROLL','ACCOUNTS','ADMIN','SUPER_ADMIN'));
ALTER TABLE approval_actions_aud DROP CONSTRAINT IF EXISTS approval_actions_aud_actor_role_check;
ALTER TABLE approval_actions_aud ADD CONSTRAINT approval_actions_aud_actor_role_check CHECK (actor_role IN
  ('RECRUITER','SALES_LEAD','SALES_MANAGER','HR','CONTRACTS','PAYROLL','ACCOUNTS','ADMIN','SUPER_ADMIN'));
ALTER TABLE candidates DROP CONSTRAINT IF EXISTS candidates_status_check;
ALTER TABLE candidates ADD CONSTRAINT candidates_status_check CHECK (status IN
  ('PENDING_SALES_LEAD_APPROVAL','SALES_LEAD_DECLINED','IN_HR_CONTRACTS_REVIEW','RETURNED_TO_SALES_LEAD',
   'COMPLETED','OVERRIDE_APPROVED','OVERRIDE_REJECTED'));
ALTER TABLE candidates_aud DROP CONSTRAINT IF EXISTS candidates_aud_status_check;
ALTER TABLE candidates_aud ADD CONSTRAINT candidates_aud_status_check CHECK (status IN
  ('PENDING_SALES_LEAD_APPROVAL','SALES_LEAD_DECLINED','IN_HR_CONTRACTS_REVIEW','RETURNED_TO_SALES_LEAD',
   'COMPLETED','OVERRIDE_APPROVED','OVERRIDE_REJECTED'));
