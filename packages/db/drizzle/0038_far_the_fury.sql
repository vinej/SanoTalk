CREATE TABLE "sanotalk_wearable_connection" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"provider" text NOT NULL,
	"terra_user_id" text NOT NULL,
	"scopes" text,
	"status" text DEFAULT 'active' NOT NULL,
	"connected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_synced_at" timestamp with time zone,
	"last_error_at" timestamp with time zone,
	"last_error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sanotalk_vital_sign" ADD COLUMN "external_id" text;--> statement-breakpoint
ALTER TABLE "sanotalk_wearable_connection" ADD CONSTRAINT "sanotalk_wearable_connection_user_id_sanotalk_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."sanotalk_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "wearable_connection_user_idx" ON "sanotalk_wearable_connection" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "wearable_connection_terra_user_id_uniq" ON "sanotalk_wearable_connection" USING btree ("terra_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "vital_sign_user_source_external_id_uniq" ON "sanotalk_vital_sign" USING btree ("user_id","source","external_id") WHERE "sanotalk_vital_sign"."external_id" IS NOT NULL;