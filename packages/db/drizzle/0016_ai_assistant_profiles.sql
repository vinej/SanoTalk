CREATE TABLE "sanotalk_ai_assistant_profile" (
  "id"            uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id"       text NOT NULL UNIQUE REFERENCES "sanotalk_user"("id") ON DELETE CASCADE,
  "type"          text NOT NULL,
  "gender"        text NOT NULL,
  "voice_id"      text NOT NULL,
  "system_prompt" text NOT NULL,
  "personality"   text NOT NULL,
  "is_active"     boolean NOT NULL DEFAULT true,
  "created_at"    timestamp NOT NULL DEFAULT now(),
  "updated_at"    timestamp NOT NULL DEFAULT now()
);
