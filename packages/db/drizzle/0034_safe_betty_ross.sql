CREATE TABLE "sanotalk_agenda_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"event_type" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"location" text,
	"start_at" timestamp NOT NULL,
	"end_at" timestamp,
	"all_day" boolean DEFAULT false NOT NULL,
	"recurrence_rule" text,
	"color" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sanotalk_availability_slot" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"professional_id" text NOT NULL,
	"day_of_week" integer NOT NULL,
	"start_time" text NOT NULL,
	"end_time" text NOT NULL,
	"slot_duration_mins" integer DEFAULT 30 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "availability_slot_prof_day_time_unq" UNIQUE("professional_id","day_of_week","start_time")
);
--> statement-breakpoint
CREATE TABLE "sanotalk_medication_schedule" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"medication_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"time_of_day" text NOT NULL,
	"label" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sanotalk_agenda_event" ADD CONSTRAINT "sanotalk_agenda_event_user_id_sanotalk_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."sanotalk_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sanotalk_availability_slot" ADD CONSTRAINT "sanotalk_availability_slot_professional_id_sanotalk_user_id_fk" FOREIGN KEY ("professional_id") REFERENCES "public"."sanotalk_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sanotalk_medication_schedule" ADD CONSTRAINT "sanotalk_medication_schedule_medication_id_sanotalk_medication_id_fk" FOREIGN KEY ("medication_id") REFERENCES "public"."sanotalk_medication"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sanotalk_medication_schedule" ADD CONSTRAINT "sanotalk_medication_schedule_user_id_sanotalk_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."sanotalk_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agenda_event_user_idx" ON "sanotalk_agenda_event" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "agenda_event_user_start_idx" ON "sanotalk_agenda_event" USING btree ("user_id","start_at");--> statement-breakpoint
CREATE INDEX "availability_slot_prof_idx" ON "sanotalk_availability_slot" USING btree ("professional_id");--> statement-breakpoint
CREATE INDEX "availability_slot_prof_day_idx" ON "sanotalk_availability_slot" USING btree ("professional_id","day_of_week");--> statement-breakpoint
CREATE INDEX "medication_schedule_user_idx" ON "sanotalk_medication_schedule" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "medication_schedule_med_idx" ON "sanotalk_medication_schedule" USING btree ("medication_id");