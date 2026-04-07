CREATE TABLE IF NOT EXISTS "sanotalk_er_favorite" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"facility_name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sanotalk_er_favorite" ADD CONSTRAINT "sanotalk_er_favorite_user_id_sanotalk_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."sanotalk_user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "er_favorite_user_facility_idx" ON "sanotalk_er_favorite" USING btree ("user_id","facility_name");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "er_favorite_user_idx" ON "sanotalk_er_favorite" USING btree ("user_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sanotalk_er_snapshot" (
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
CREATE INDEX IF NOT EXISTS "er_snapshot_facility_time_idx" ON "sanotalk_er_snapshot" USING btree ("facility_name","snapshot_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "er_snapshot_time_idx" ON "sanotalk_er_snapshot" USING btree ("snapshot_at");
