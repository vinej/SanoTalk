ALTER TABLE "sanotalk_user_property" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now() NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "user_property_user_key_uniq" ON "sanotalk_user_property" ("user_id", "key");
