CREATE TABLE "sanotalk_saved_conversation" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" text NOT NULL REFERENCES "sanotalk_user"("id") ON DELETE CASCADE,
  "chat_type" text NOT NULL,
  "title" text NOT NULL,
  "messages" jsonb NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now()
);
