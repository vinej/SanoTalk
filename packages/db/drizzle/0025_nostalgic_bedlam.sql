CREATE TYPE "public"."sanotalk_breach_severity" AS ENUM('low', 'medium', 'high', 'critical');--> statement-breakpoint
CREATE TYPE "public"."sanotalk_breach_status" AS ENUM('open', 'investigating', 'resolved');--> statement-breakpoint
CREATE TYPE "public"."sanotalk_consent_type" AS ENUM('cookies', 'analytics', 'privacy_policy');--> statement-breakpoint
CREATE TABLE "sanotalk_user_property" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"key" text NOT NULL,
	"value" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sanotalk_saved_conversation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"chat_type" text NOT NULL,
	"title" text NOT NULL,
	"messages" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sanotalk_connection_request" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"from_user_id" text NOT NULL,
	"to_user_id" text NOT NULL,
	"type" text NOT NULL,
	"link_type" text DEFAULT 'doctor' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sanotalk_user_friend" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"friend_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sanotalk_user_link" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" text NOT NULL,
	"professional_id" text NOT NULL,
	"link_type" text DEFAULT 'doctor' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sanotalk_ai_assistant_profile" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"gender" text NOT NULL,
	"voice_id" text NOT NULL,
	"system_prompt" text NOT NULL,
	"personality" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "sanotalk_ai_assistant_profile_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "sanotalk_vital_sign" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"value_primary" real NOT NULL,
	"value_secondary" real,
	"unit" text NOT NULL,
	"notes" text,
	"source" text DEFAULT 'manual' NOT NULL,
	"measured_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sanotalk_medication" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"dosage" text NOT NULL,
	"frequency" text NOT NULL,
	"route" text,
	"prescribed_by" text,
	"reason" text,
	"start_date" timestamp NOT NULL,
	"end_date" timestamp,
	"is_active" boolean DEFAULT true NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sanotalk_symptom_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"date" date NOT NULL,
	"pain_level" smallint,
	"mood" smallint,
	"energy" smallint,
	"sleep_quality" smallint,
	"sleep_hours" real,
	"stress" smallint,
	"appetite" smallint,
	"custom_symptoms" text[],
	"body_location" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sanotalk_er_favorite" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"facility_name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sanotalk_er_snapshot" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"facility_name" text NOT NULL,
	"occupancy_rate" smallint,
	"patients_waiting" smallint NOT NULL,
	"avg_wait_hours" real NOT NULL,
	"stretcher_count" smallint NOT NULL,
	"stretchers_occupied" smallint NOT NULL,
	"patients_over_24h" smallint NOT NULL,
	"patients_over_48h" smallint NOT NULL,
	"snapshot_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sanotalk_allergy" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"name" text NOT NULL,
	"severity" text NOT NULL,
	"reaction" text,
	"diagnosed_date" date,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sanotalk_chronic_condition" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"status" text NOT NULL,
	"severity" text NOT NULL,
	"diagnosed_date" date,
	"medications" text[],
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sanotalk_audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text,
	"action" text NOT NULL,
	"target_user_id" text,
	"resource_type" text,
	"resource_id" text,
	"metadata" jsonb,
	"ip_address" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sanotalk_breach_record" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"severity" "sanotalk_breach_severity" NOT NULL,
	"data_types_affected" text,
	"users_affected" integer DEFAULT 0 NOT NULL,
	"discovered_at" timestamp NOT NULL,
	"reported_to_cai_at" timestamp,
	"users_notified_at" timestamp,
	"remediation_steps" text,
	"status" "sanotalk_breach_status" DEFAULT 'open' NOT NULL,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sanotalk_consent_record" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text,
	"anonymous_id" text,
	"consent_type" "sanotalk_consent_type" NOT NULL,
	"consented" boolean NOT NULL,
	"policy_version" text NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"withdrawn_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "sanotalk_data_retention_policy" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"data_type" text NOT NULL,
	"retention_days" integer NOT NULL,
	"description" text,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "sanotalk_data_retention_policy_data_type_unique" UNIQUE("data_type")
);
--> statement-breakpoint
ALTER TABLE "sanotalk_user" DROP CONSTRAINT "sanotalk_user_linked_doctor_id_sanotalk_user_id_fk";
--> statement-breakpoint
ALTER TABLE "sanotalk_user" DROP CONSTRAINT "sanotalk_user_linked_pharmacist_id_sanotalk_user_id_fk";
--> statement-breakpoint
ALTER TABLE "sanotalk_chat_message" ALTER COLUMN "session_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "sanotalk_user" ADD COLUMN "approved" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "sanotalk_user" ADD COLUMN "properties_language" text DEFAULT 'en' NOT NULL;--> statement-breakpoint
ALTER TABLE "sanotalk_user" ADD COLUMN "deletion_requested_at" timestamp;--> statement-breakpoint
ALTER TABLE "sanotalk_user" ADD COLUMN "deletion_scheduled_for" timestamp;--> statement-breakpoint
ALTER TABLE "sanotalk_talk_session" ADD COLUMN "agent_type" text;--> statement-breakpoint
ALTER TABLE "sanotalk_task" ADD COLUMN "task_type" text DEFAULT 'standard' NOT NULL;--> statement-breakpoint
ALTER TABLE "sanotalk_task" ADD COLUMN "remark" text;--> statement-breakpoint
ALTER TABLE "sanotalk_chat_message" ADD COLUMN "user_id" text;--> statement-breakpoint
ALTER TABLE "sanotalk_chat_message" ADD COLUMN "chat_type" text;--> statement-breakpoint
ALTER TABLE "sanotalk_user_property" ADD CONSTRAINT "sanotalk_user_property_user_id_sanotalk_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."sanotalk_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sanotalk_saved_conversation" ADD CONSTRAINT "sanotalk_saved_conversation_user_id_sanotalk_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."sanotalk_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sanotalk_connection_request" ADD CONSTRAINT "sanotalk_connection_request_from_user_id_sanotalk_user_id_fk" FOREIGN KEY ("from_user_id") REFERENCES "public"."sanotalk_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sanotalk_connection_request" ADD CONSTRAINT "sanotalk_connection_request_to_user_id_sanotalk_user_id_fk" FOREIGN KEY ("to_user_id") REFERENCES "public"."sanotalk_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sanotalk_user_friend" ADD CONSTRAINT "sanotalk_user_friend_user_id_sanotalk_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."sanotalk_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sanotalk_user_friend" ADD CONSTRAINT "sanotalk_user_friend_friend_id_sanotalk_user_id_fk" FOREIGN KEY ("friend_id") REFERENCES "public"."sanotalk_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sanotalk_user_link" ADD CONSTRAINT "sanotalk_user_link_patient_id_sanotalk_user_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."sanotalk_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sanotalk_user_link" ADD CONSTRAINT "sanotalk_user_link_professional_id_sanotalk_user_id_fk" FOREIGN KEY ("professional_id") REFERENCES "public"."sanotalk_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sanotalk_ai_assistant_profile" ADD CONSTRAINT "sanotalk_ai_assistant_profile_user_id_sanotalk_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."sanotalk_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sanotalk_vital_sign" ADD CONSTRAINT "sanotalk_vital_sign_user_id_sanotalk_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."sanotalk_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sanotalk_medication" ADD CONSTRAINT "sanotalk_medication_user_id_sanotalk_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."sanotalk_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sanotalk_symptom_log" ADD CONSTRAINT "sanotalk_symptom_log_user_id_sanotalk_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."sanotalk_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sanotalk_er_favorite" ADD CONSTRAINT "sanotalk_er_favorite_user_id_sanotalk_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."sanotalk_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sanotalk_allergy" ADD CONSTRAINT "sanotalk_allergy_user_id_sanotalk_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."sanotalk_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sanotalk_chronic_condition" ADD CONSTRAINT "sanotalk_chronic_condition_user_id_sanotalk_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."sanotalk_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sanotalk_audit_log" ADD CONSTRAINT "sanotalk_audit_log_user_id_sanotalk_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."sanotalk_user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sanotalk_breach_record" ADD CONSTRAINT "sanotalk_breach_record_created_by_sanotalk_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."sanotalk_user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sanotalk_consent_record" ADD CONSTRAINT "sanotalk_consent_record_user_id_sanotalk_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."sanotalk_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "user_property_user_key_uniq" ON "sanotalk_user_property" USING btree ("user_id","key");--> statement-breakpoint
CREATE UNIQUE INDEX "connection_request_from_to_type_link_uniq" ON "sanotalk_connection_request" USING btree ("from_user_id","to_user_id","type","link_type");--> statement-breakpoint
CREATE UNIQUE INDEX "user_friend_uniq" ON "sanotalk_user_friend" USING btree ("user_id","friend_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_link_patient_professional_type_uniq" ON "sanotalk_user_link" USING btree ("patient_id","professional_id","link_type");--> statement-breakpoint
CREATE INDEX "vital_sign_user_type_idx" ON "sanotalk_vital_sign" USING btree ("user_id","type");--> statement-breakpoint
CREATE INDEX "vital_sign_measured_at_idx" ON "sanotalk_vital_sign" USING btree ("user_id","measured_at");--> statement-breakpoint
CREATE INDEX "medication_user_id_idx" ON "sanotalk_medication" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "medication_user_active_idx" ON "sanotalk_medication" USING btree ("user_id","is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "symptom_log_user_date_idx" ON "sanotalk_symptom_log" USING btree ("user_id","date");--> statement-breakpoint
CREATE INDEX "symptom_log_user_id_idx" ON "sanotalk_symptom_log" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "er_favorite_user_facility_idx" ON "sanotalk_er_favorite" USING btree ("user_id","facility_name");--> statement-breakpoint
CREATE INDEX "er_favorite_user_idx" ON "sanotalk_er_favorite" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "er_snapshot_facility_time_idx" ON "sanotalk_er_snapshot" USING btree ("facility_name","snapshot_at");--> statement-breakpoint
CREATE INDEX "er_snapshot_time_idx" ON "sanotalk_er_snapshot" USING btree ("snapshot_at");--> statement-breakpoint
CREATE INDEX "allergy_user_id_idx" ON "sanotalk_allergy" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "allergy_user_name_idx" ON "sanotalk_allergy" USING btree ("user_id","name");--> statement-breakpoint
CREATE INDEX "chronic_condition_user_id_idx" ON "sanotalk_chronic_condition" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "chronic_condition_user_name_idx" ON "sanotalk_chronic_condition" USING btree ("user_id","name");--> statement-breakpoint
CREATE INDEX "audit_log_user_idx" ON "sanotalk_audit_log" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "audit_log_action_idx" ON "sanotalk_audit_log" USING btree ("action");--> statement-breakpoint
CREATE INDEX "audit_log_created_at_idx" ON "sanotalk_audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "consent_record_user_idx" ON "sanotalk_consent_record" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "consent_record_type_idx" ON "sanotalk_consent_record" USING btree ("consent_type");--> statement-breakpoint
ALTER TABLE "sanotalk_chat_message" ADD CONSTRAINT "sanotalk_chat_message_user_id_sanotalk_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."sanotalk_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sanotalk_user" DROP COLUMN "linked_doctor_id";--> statement-breakpoint
ALTER TABLE "sanotalk_user" DROP COLUMN "linked_pharmacist_id";