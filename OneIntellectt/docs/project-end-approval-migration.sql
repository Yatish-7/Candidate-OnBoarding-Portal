-- Project end date approval: the recruiter raises it, the Lead / Manager / Super Admin approve or decline.
-- New trail action types RAISE_PROJECT_END, APPROVE_PROJECT_END, DECLINE_PROJECT_END.
-- (candidates.project_end_status is added by ddl-auto=update, default NOT_RAISED.) Run once per database.
ALTER TABLE approval_actions DROP CONSTRAINT IF EXISTS approval_actions_action_type_check;
ALTER TABLE approval_actions ADD CONSTRAINT approval_actions_action_type_check CHECK (action_type IN
  ('SUBMIT','APPROVE','DECLINE','APPROVE_DOJ','SET_PROJECT_END','RAISE_PROJECT_END','APPROVE_PROJECT_END',
   'DECLINE_PROJECT_END','RATE_CHANGE','EDIT','OVERRIDE_APPROVE','OVERRIDE_DECLINE'));
ALTER TABLE approval_actions_aud DROP CONSTRAINT IF EXISTS approval_actions_aud_action_type_check;
ALTER TABLE approval_actions_aud ADD CONSTRAINT approval_actions_aud_action_type_check CHECK (action_type IN
  ('SUBMIT','APPROVE','DECLINE','APPROVE_DOJ','SET_PROJECT_END','RAISE_PROJECT_END','APPROVE_PROJECT_END',
   'DECLINE_PROJECT_END','RATE_CHANGE','EDIT','OVERRIDE_APPROVE','OVERRIDE_DECLINE'));
