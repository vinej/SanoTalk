ALTER TABLE "sanotalk_chat_message" ADD COLUMN "chat_type" text;
UPDATE "sanotalk_chat_message" SET "chat_type" = 'general' WHERE "session_id" IS NULL;
