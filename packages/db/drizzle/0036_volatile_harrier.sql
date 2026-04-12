ALTER TABLE "sanotalk_account" ALTER COLUMN "access_token_expires_at" SET DATA TYPE timestamp with time zone USING "access_token_expires_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "sanotalk_account" ALTER COLUMN "refresh_token_expires_at" SET DATA TYPE timestamp with time zone USING "refresh_token_expires_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "sanotalk_account" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone USING "created_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "sanotalk_account" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "sanotalk_account" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone USING "updated_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "sanotalk_account" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "sanotalk_session" ALTER COLUMN "expires_at" SET DATA TYPE timestamp with time zone USING "expires_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "sanotalk_session" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone USING "created_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "sanotalk_session" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "sanotalk_session" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone USING "updated_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "sanotalk_session" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "sanotalk_user" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone USING "created_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "sanotalk_user" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "sanotalk_user" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone USING "updated_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "sanotalk_user" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "sanotalk_user" ALTER COLUMN "deletion_requested_at" SET DATA TYPE timestamp with time zone USING "deletion_requested_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "sanotalk_user" ALTER COLUMN "deletion_scheduled_for" SET DATA TYPE timestamp with time zone USING "deletion_scheduled_for" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "sanotalk_verification" ALTER COLUMN "expires_at" SET DATA TYPE timestamp with time zone USING "expires_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "sanotalk_verification" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone USING "created_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "sanotalk_verification" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "sanotalk_verification" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone USING "updated_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "sanotalk_verification" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "sanotalk_session_participant" ALTER COLUMN "joined_at" SET DATA TYPE timestamp with time zone USING "joined_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "sanotalk_session_participant" ALTER COLUMN "left_at" SET DATA TYPE timestamp with time zone USING "left_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "sanotalk_talk_session" ALTER COLUMN "scheduled_at" SET DATA TYPE timestamp with time zone USING "scheduled_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "sanotalk_talk_session" ALTER COLUMN "started_at" SET DATA TYPE timestamp with time zone USING "started_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "sanotalk_talk_session" ALTER COLUMN "ended_at" SET DATA TYPE timestamp with time zone USING "ended_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "sanotalk_talk_session" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone USING "created_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "sanotalk_talk_session" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "sanotalk_talk_session" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone USING "updated_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "sanotalk_talk_session" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "sanotalk_transcript" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone USING "created_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "sanotalk_transcript" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "sanotalk_transcript_summary" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone USING "created_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "sanotalk_transcript_summary" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "sanotalk_transcript_summary" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone USING "updated_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "sanotalk_transcript_summary" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "sanotalk_recording" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone USING "created_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "sanotalk_recording" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "sanotalk_agent_run" ALTER COLUMN "started_at" SET DATA TYPE timestamp with time zone USING "started_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "sanotalk_agent_run" ALTER COLUMN "started_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "sanotalk_agent_run" ALTER COLUMN "completed_at" SET DATA TYPE timestamp with time zone USING "completed_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "sanotalk_task" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone USING "created_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "sanotalk_task" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "sanotalk_task" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone USING "updated_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "sanotalk_task" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "sanotalk_chat_message" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone USING "created_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "sanotalk_chat_message" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "sanotalk_user_property" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone USING "created_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "sanotalk_user_property" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "sanotalk_user_property" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone USING "updated_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "sanotalk_user_property" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "sanotalk_saved_conversation" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone USING "created_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "sanotalk_saved_conversation" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "sanotalk_connection_request" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone USING "created_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "sanotalk_connection_request" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "sanotalk_connection_request" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone USING "updated_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "sanotalk_connection_request" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "sanotalk_user_friend" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone USING "created_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "sanotalk_user_friend" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "sanotalk_user_link" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone USING "created_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "sanotalk_user_link" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "sanotalk_ai_assistant_profile" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone USING "created_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "sanotalk_ai_assistant_profile" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "sanotalk_ai_assistant_profile" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone USING "updated_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "sanotalk_ai_assistant_profile" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "sanotalk_vital_sign" ALTER COLUMN "measured_at" SET DATA TYPE timestamp with time zone USING "measured_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "sanotalk_vital_sign" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone USING "created_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "sanotalk_vital_sign" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "sanotalk_symptom_log" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone USING "created_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "sanotalk_symptom_log" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "sanotalk_symptom_log" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone USING "updated_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "sanotalk_symptom_log" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "sanotalk_er_favorite" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone USING "created_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "sanotalk_er_favorite" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "sanotalk_er_snapshot" ALTER COLUMN "snapshot_at" SET DATA TYPE timestamp with time zone USING "snapshot_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "sanotalk_er_snapshot" ALTER COLUMN "snapshot_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "sanotalk_allergy" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone USING "created_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "sanotalk_allergy" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "sanotalk_allergy" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone USING "updated_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "sanotalk_allergy" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "sanotalk_chronic_condition" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone USING "created_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "sanotalk_chronic_condition" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "sanotalk_chronic_condition" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone USING "updated_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "sanotalk_chronic_condition" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "sanotalk_audit_log" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone USING "created_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "sanotalk_audit_log" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "sanotalk_breach_record" ALTER COLUMN "discovered_at" SET DATA TYPE timestamp with time zone USING "discovered_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "sanotalk_breach_record" ALTER COLUMN "reported_to_cai_at" SET DATA TYPE timestamp with time zone USING "reported_to_cai_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "sanotalk_breach_record" ALTER COLUMN "users_notified_at" SET DATA TYPE timestamp with time zone USING "users_notified_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "sanotalk_breach_record" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone USING "created_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "sanotalk_breach_record" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "sanotalk_breach_record" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone USING "updated_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "sanotalk_breach_record" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "sanotalk_consent_record" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone USING "created_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "sanotalk_consent_record" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "sanotalk_consent_record" ALTER COLUMN "withdrawn_at" SET DATA TYPE timestamp with time zone USING "withdrawn_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "sanotalk_data_retention_policy" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone USING "updated_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "sanotalk_data_retention_policy" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "sanotalk_friend_chat_participant" ALTER COLUMN "joined_at" SET DATA TYPE timestamp with time zone USING "joined_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "sanotalk_friend_chat_participant" ALTER COLUMN "joined_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "sanotalk_friend_chat_room" ALTER COLUMN "last_activity_at" SET DATA TYPE timestamp with time zone USING "last_activity_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "sanotalk_friend_chat_room" ALTER COLUMN "last_activity_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "sanotalk_friend_chat_room" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone USING "created_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "sanotalk_friend_chat_room" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "sanotalk_workout_log" ALTER COLUMN "completed_at" SET DATA TYPE timestamp with time zone USING "completed_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "sanotalk_workout_log" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone USING "created_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "sanotalk_workout_log" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "sanotalk_outdoor_custom_activity" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone USING "created_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "sanotalk_outdoor_custom_activity" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "sanotalk_outdoor_log" ALTER COLUMN "completed_at" SET DATA TYPE timestamp with time zone USING "completed_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "sanotalk_outdoor_log" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone USING "created_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "sanotalk_outdoor_log" ALTER COLUMN "created_at" SET DEFAULT now();