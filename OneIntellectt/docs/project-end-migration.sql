-- Project end date: new trail stage PROJECT_END and action SET_PROJECT_END.
-- ddl-auto=update adds candidates.project_end_date by itself but not the CHECK constraints.
-- Run once per database BEFORE using the new action.
ALTER TABLE approval_actions DROP CONSTRAINT IF EXISTS approval_actions_stage_check;
ALTER TABLE approval_actions ADD CONSTRAINT approval_actions_stage_check CHECK (stage IN
  ('RECRUITER','SALES_LEAD','HR','CONTRACTS','PAYROLL','ACCOUNTS','DOJ','PROJECT_END','SUPER_ADMIN'));
ALTER TABLE approval_actions_aud DROP CONSTRAINT IF EXISTS approval_actions_aud_stage_check;
ALTER TABLE approval_actions_aud ADD CONSTRAINT approval_actions_aud_stage_check CHECK (stage IN
  ('RECRUITER','SALES_LEAD','HR','CONTRACTS','PAYROLL','ACCOUNTS','DOJ','PROJECT_END','SUPER_ADMIN'));
ALTER TABLE approval_actions DROP CONSTRAINT IF EXISTS approval_actions_action_type_check;
ALTER TABLE approval_actions ADD CONSTRAINT approval_actions_action_type_check CHECK (action_type IN
  ('SUBMIT','APPROVE','DECLINE','APPROVE_DOJ','SET_PROJECT_END','OVERRIDE_APPROVE','OVERRIDE_DECLINE'));
ALTER TABLE approval_actions_aud DROP CONSTRAINT IF EXISTS approval_actions_aud_action_type_check;
ALTER TABLE approval_actions_aud ADD CONSTRAINT approval_actions_aud_action_type_check CHECK (action_type IN
  ('SUBMIT','APPROVE','DECLINE','APPROVE_DOJ','SET_PROJECT_END','OVERRIDE_APPROVE','OVERRIDE_DECLINE'));
