CREATE TABLE "sanotalk_chat_message" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sanotalk_chat_message" ADD CONSTRAINT "sanotalk_chat_message_session_id_sanotalk_talk_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sanotalk_talk_session"("id") ON DELETE cascade ON UPDATE no action;