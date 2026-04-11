CREATE TABLE "sanotalk_outdoor_custom_activity" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"intensity" text NOT NULL,
	"suggested_mins" integer DEFAULT 30 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sanotalk_outdoor_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"activity_id" text NOT NULL,
	"category" text NOT NULL,
	"intensity" text NOT NULL,
	"duration_secs" integer NOT NULL,
	"distance_m" integer,
	"notes" text,
	"completed_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sanotalk_outdoor_custom_activity" ADD CONSTRAINT "sanotalk_outdoor_custom_activity_user_id_sanotalk_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."sanotalk_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sanotalk_outdoor_log" ADD CONSTRAINT "sanotalk_outdoor_log_user_id_sanotalk_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."sanotalk_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "outdoor_custom_activity_user_idx" ON "sanotalk_outdoor_custom_activity" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "outdoor_log_user_idx" ON "sanotalk_outdoor_log" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "outdoor_log_user_completed_idx" ON "sanotalk_outdoor_log" USING btree ("user_id","completed_at");