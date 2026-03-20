CREATE TYPE "public"."sanotalk_session_status" AS ENUM('scheduled', 'active', 'completed', 'cancelled');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sanotalk_account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sanotalk_session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "sanotalk_session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sanotalk_user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"role" text DEFAULT 'patient' NOT NULL,
	"specialty" text,
	"license_number" text,
	CONSTRAINT "sanotalk_user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sanotalk_verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sanotalk_session_participant" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"joined_at" timestamp,
	"left_at" timestamp,
	"livekit_participant_id" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sanotalk_talk_session" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"status" "sanotalk_session_status" DEFAULT 'scheduled' NOT NULL,
	"room_name" text NOT NULL,
	"host_id" text NOT NULL,
	"scheduled_at" timestamp,
	"started_at" timestamp,
	"ended_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "sanotalk_talk_session_room_name_unique" UNIQUE("room_name")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sanotalk_transcript" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"speaker_id" text,
	"speaker_label" text,
	"content" text NOT NULL,
	"confidence" real,
	"start_ms" real,
	"end_ms" real,
	"raw_deepgram_result" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sanotalk_transcript_summary" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"summary" text NOT NULL,
	"key_points" jsonb,
	"action_items" jsonb,
	"soap_note" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "sanotalk_transcript_summary_session_id_unique" UNIQUE("session_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sanotalk_recording" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"storage_key" text NOT NULL,
	"storage_bucket" text DEFAULT 'sanotalk' NOT NULL,
	"mime_type" text DEFAULT 'video/mp4' NOT NULL,
	"size_bytes" integer,
	"duration_ms" integer,
	"is_processed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sanotalk_agent_run" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid,
	"agent_name" text NOT NULL,
	"input" jsonb,
	"output" jsonb,
	"status" text DEFAULT 'pending' NOT NULL,
	"error_message" text,
	"started_at" timestamp DEFAULT now(),
	"completed_at" timestamp
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sanotalk_account" ADD CONSTRAINT "sanotalk_account_user_id_sanotalk_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."sanotalk_user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sanotalk_session" ADD CONSTRAINT "sanotalk_session_user_id_sanotalk_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."sanotalk_user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sanotalk_session_participant" ADD CONSTRAINT "sanotalk_session_participant_session_id_sanotalk_talk_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sanotalk_talk_session"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sanotalk_session_participant" ADD CONSTRAINT "sanotalk_session_participant_user_id_sanotalk_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."sanotalk_user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sanotalk_talk_session" ADD CONSTRAINT "sanotalk_talk_session_host_id_sanotalk_user_id_fk" FOREIGN KEY ("host_id") REFERENCES "public"."sanotalk_user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sanotalk_transcript" ADD CONSTRAINT "sanotalk_transcript_session_id_sanotalk_talk_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sanotalk_talk_session"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sanotalk_transcript" ADD CONSTRAINT "sanotalk_transcript_speaker_id_sanotalk_user_id_fk" FOREIGN KEY ("speaker_id") REFERENCES "public"."sanotalk_user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sanotalk_transcript_summary" ADD CONSTRAINT "sanotalk_transcript_summary_session_id_sanotalk_talk_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sanotalk_talk_session"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sanotalk_recording" ADD CONSTRAINT "sanotalk_recording_session_id_sanotalk_talk_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sanotalk_talk_session"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sanotalk_agent_run" ADD CONSTRAINT "sanotalk_agent_run_session_id_sanotalk_talk_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sanotalk_talk_session"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
