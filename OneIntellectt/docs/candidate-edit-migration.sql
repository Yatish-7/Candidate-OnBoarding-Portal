-- HR can edit a candidate's details: new trail action type EDIT.
-- Run once per database BEFORE HR uses "Edit details".
ALTER TABLE approval_actions DROP CONSTRAINT IF EXISTS approval_actions_action_type_check;
ALTER TABLE approval_actions ADD CONSTRAINT approval_actions_action_type_check CHECK (action_type IN
  ('SUBMIT','APPROVE','DECLINE','APPROVE_DOJ','SET_PROJECT_END','RATE_CHANGE','EDIT','OVERRIDE_APPROVE','OVERRIDE_DECLINE'));
ALTER TABLE approval_actions_aud DROP CONSTRAINT IF EXISTS approval_actions_aud_action_type_check;
ALTER TABLE approval_actions_aud ADD CONSTRAINT approval_actions_aud_action_type_check CHECK (action_type IN
  ('SUBMIT','APPROVE','DECLINE','APPROVE_DOJ','SET_PROJECT_END','RATE_CHANGE','EDIT','OVERRIDE_APPROVE','OVERRIDE_DECLINE'));
