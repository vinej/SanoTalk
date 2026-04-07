CREATE TABLE IF NOT EXISTS "sanotalk_symptom_log" (
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
DO $$ BEGIN
 ALTER TABLE "sanotalk_symptom_log" ADD CONSTRAINT "sanotalk_symptom_log_user_id_sanotalk_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."sanotalk_user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "symptom_log_user_date_idx" ON "sanotalk_symptom_log" USING btree ("user_id","date");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "symptom_log_user_id_idx" ON "sanotalk_symptom_log" USING btree ("user_id");
