CREATE TABLE "sanotalk_two_factor" (
	"id" text PRIMARY KEY NOT NULL,
	"secret" text,
	"backup_codes" text,
	"user_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sanotalk_task" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'not_assigned' NOT NULL,
	"assigned_user_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sanotalk_user" ADD COLUMN "two_factor_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "sanotalk_two_factor" ADD CONSTRAINT "sanotalk_two_factor_user_id_sanotalk_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."sanotalk_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sanotalk_task" ADD CONSTRAINT "sanotalk_task_assigned_user_id_sanotalk_user_id_fk" FOREIGN KEY ("assigned_user_id") REFERENCES "public"."sanotalk_user"("id") ON DELETE set null ON UPDATE no action;