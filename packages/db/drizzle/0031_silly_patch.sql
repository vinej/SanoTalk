CREATE TABLE "sanotalk_friend_chat_participant" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"room_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"joined_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sanotalk_friend_chat_room" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"room_name" text NOT NULL,
	"created_by_id" text NOT NULL,
	"name" text,
	"last_activity_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "sanotalk_friend_chat_room_room_name_unique" UNIQUE("room_name")
);
--> statement-breakpoint
ALTER TABLE "sanotalk_friend_chat_participant" ADD CONSTRAINT "sanotalk_friend_chat_participant_room_id_sanotalk_friend_chat_room_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."sanotalk_friend_chat_room"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sanotalk_friend_chat_participant" ADD CONSTRAINT "sanotalk_friend_chat_participant_user_id_sanotalk_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."sanotalk_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sanotalk_friend_chat_room" ADD CONSTRAINT "sanotalk_friend_chat_room_created_by_id_sanotalk_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."sanotalk_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "friend_chat_participant_room_user_uniq" ON "sanotalk_friend_chat_participant" USING btree ("room_id","user_id");--> statement-breakpoint
CREATE INDEX "friend_chat_participant_room_idx" ON "sanotalk_friend_chat_participant" USING btree ("room_id");