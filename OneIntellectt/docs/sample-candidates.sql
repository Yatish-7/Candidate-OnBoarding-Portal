-- Two sample candidates, inserted straight into the database (no application code runs, so
-- NO emails are sent and no audit-log entries are written). Both wait for Sales Lead / Sales
-- Manager approval, exactly as if the recruiter had just submitted them.
-- Run:  psql -U postgres -d Intellectt -f docs/sample-candidates.sql
-- Remove later:  DELETE FROM approval_actions WHERE candidate_id IN (SELECT id FROM candidates WHERE candidate_name LIKE 'SAMPLE - %');
--                DELETE FROM candidates WHERE candidate_name LIKE 'SAMPLE - %';
BEGIN;

WITH c AS (
  INSERT INTO candidates (
    candidate_name, candidate_personal_email, candidate_direct_number,
    recruiter_name, recruiter_location, sourcing_recruiter, lead_or_team_name, internal_entity,
    client_name, client_reporting_manager, reporting_manager_email, reporting_manager_contact, client_location,
    vendor, job_role, location, employment_type, bill_rate, pay_rate, start_date, doj_date,
    referral, visa_status, work_authorization_exp_date, relocation_expenses, pay_cycle, existing_employee,
    job_description, internal_company_placement, shared_placement, payroll_company,
    status, hr_decision, contracts_decision, payroll_decision, accounts_decision, doj_status,
    submitted_by_id, team_id, created_at, updated_at)
  VALUES (
    'SAMPLE - Arjun Rao', 'arjun.rao.sample@example.com', '(555) 010-1001',
    'Meenakshi', 'Hyderabad', 'Meenakshi', 'Yatish''s Team', 'novozen',
    'Acme Corp', 'Dana Miller', 'dana.miller@acme.example.com', '(555) 010-2001', 'Dallas, TX',
    'Acme Staffing', 'Java Developer', 'Dallas, TX', 'W2', '85', '65', DATE '2026-11-15', DATE '2026-11-16',
    'No', 'H1B', DATE '2028-06-30', 'None', 'BI_WEEKLY', false,
    'Backend Java developer for a 12-month engagement.', false, false, 'novozen',
    'PENDING_SALES_LEAD_APPROVAL', 'PENDING', 'PENDING', 'PENDING', 'PENDING', 'RAISED',
    81, 24, now(), now())
  RETURNING id, submitted_by_id)
INSERT INTO approval_actions (candidate_id, actor_id, actor_role, stage, action_type, comment, created_at)
SELECT id, submitted_by_id, 'RECRUITER', 'RECRUITER', 'SUBMIT', 'Sample candidate', now() FROM c;

WITH c AS (
  INSERT INTO candidates (
    candidate_name, candidate_personal_email, candidate_direct_number,
    recruiter_name, recruiter_location, sourcing_recruiter, lead_or_team_name, internal_entity,
    client_name, client_reporting_manager, reporting_manager_email, reporting_manager_contact, client_location,
    vendor, job_role, location, employment_type, bill_rate, pay_rate, start_date, doj_date,
    referral, visa_status, work_authorization_exp_date, relocation_expenses, pay_cycle, existing_employee,
    job_description, internal_company_placement, shared_placement, payroll_company,
    status, hr_decision, contracts_decision, payroll_decision, accounts_decision, doj_status,
    submitted_by_id, team_id, created_at, updated_at)
  VALUES (
    'SAMPLE - Priya Nair', 'priya.nair.sample@example.com', '(555) 010-1002',
    'Rithika', 'Noida', NULL, 'S team', 'kennedysoft',
    'Globex Inc', 'Sam Carter', 'sam.carter@globex.example.com', '(555) 010-2002', 'Austin, TX',
    'Globex Partners', 'QA Automation Engineer', 'Austin, TX', 'C2C', '78', '60', DATE '2026-11-20', DATE '2026-11-23',
    'Yes', 'US Citizen', NULL, '$1,000 one-time', 'WEEKLY', false,
    'Automation tester for a 6-month contract.', false, false, 'kennedysoft',
    'PENDING_SALES_LEAD_APPROVAL', 'PENDING', 'PENDING', 'PENDING', 'PENDING', 'RAISED',
    90, 27, now(), now())
  RETURNING id, submitted_by_id)
INSERT INTO approval_actions (candidate_id, actor_id, actor_role, stage, action_type, comment, created_at)
SELECT id, submitted_by_id, 'RECRUITER', 'RECRUITER', 'SUBMIT', 'Sample candidate', now() FROM c;

COMMIT;
