CREATE TABLE IF NOT EXISTS "sanotalk_medication" (
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
DO $$ BEGIN
 ALTER TABLE "sanotalk_medication" ADD CONSTRAINT "sanotalk_medication_user_id_sanotalk_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."sanotalk_user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "medication_user_id_idx" ON "sanotalk_medication" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "medication_user_active_idx" ON "sanotalk_medication" USING btree ("user_id","is_active");
