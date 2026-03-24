-- ============================================================
-- SanoTalk — Reset all tables (delete all rows)
-- Run with: psql $DATABASE_URL -f infra/reset-db.sql
-- ============================================================

-- Delete in child-first order to respect foreign key constraints

DELETE FROM sanotalk_agent_run;
DELETE FROM sanotalk_transcript_summary;
DELETE FROM sanotalk_transcript;
DELETE FROM sanotalk_recording;
DELETE FROM sanotalk_task;
DELETE FROM sanotalk_session_participant;
DELETE FROM sanotalk_talk_session;

-- Auth tables (sessions/accounts before users)
DELETE FROM sanotalk_verification;
DELETE FROM sanotalk_session;
DELETE FROM sanotalk_account;
DELETE FROM sanotalk_user;
DELETE FROM sanotalk_two_factor;
