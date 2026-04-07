CREATE TABLE IF NOT EXISTS "sanotalk_vital_sign" (
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
DO $$ BEGIN
 ALTER TABLE "sanotalk_vital_sign" ADD CONSTRAINT "sanotalk_vital_sign_user_id_sanotalk_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."sanotalk_user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vital_sign_user_type_idx" ON "sanotalk_vital_sign" USING btree ("user_id","type");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vital_sign_measured_at_idx" ON "sanotalk_vital_sign" USING btree ("user_id","measured_at");
