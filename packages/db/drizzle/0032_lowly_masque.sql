CREATE TABLE "sanotalk_workout_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"exercise_id" text NOT NULL,
	"category" text NOT NULL,
	"difficulty" text NOT NULL,
	"duration_secs" integer NOT NULL,
	"notes" text,
	"completed_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sanotalk_workout_log" ADD CONSTRAINT "sanotalk_workout_log_user_id_sanotalk_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."sanotalk_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "workout_log_user_idx" ON "sanotalk_workout_log" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "workout_log_user_completed_idx" ON "sanotalk_workout_log" USING btree ("user_id","completed_at");