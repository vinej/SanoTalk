ALTER TABLE "sanotalk_agent_run" ALTER COLUMN "input" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "sanotalk_agent_run" ALTER COLUMN "output" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "sanotalk_medication" ALTER COLUMN "start_date" SET DATA TYPE timestamp with time zone USING "start_date" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "sanotalk_medication" ALTER COLUMN "end_date" SET DATA TYPE timestamp with time zone USING "end_date" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "sanotalk_medication" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone USING "created_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "sanotalk_medication" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "sanotalk_medication" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone USING "updated_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "sanotalk_medication" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "sanotalk_agenda_event" ALTER COLUMN "start_at" SET DATA TYPE timestamp with time zone USING "start_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "sanotalk_agenda_event" ALTER COLUMN "end_at" SET DATA TYPE timestamp with time zone USING "end_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "sanotalk_agenda_event" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone USING "created_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "sanotalk_agenda_event" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "sanotalk_agenda_event" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone USING "updated_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "sanotalk_agenda_event" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "sanotalk_availability_slot" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone USING "created_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "sanotalk_availability_slot" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "sanotalk_availability_slot" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone USING "updated_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "sanotalk_availability_slot" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "sanotalk_medication_schedule" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone USING "created_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "sanotalk_medication_schedule" ALTER COLUMN "created_at" SET DEFAULT now();