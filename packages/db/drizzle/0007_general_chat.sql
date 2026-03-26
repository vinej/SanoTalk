ALTER TABLE "sanotalk_chat_message" ALTER COLUMN "session_id" DROP NOT NULL;
ALTER TABLE "sanotalk_chat_message" ADD COLUMN "user_id" text REFERENCES "sanotalk_user"("id") ON DELETE CASCADE;
