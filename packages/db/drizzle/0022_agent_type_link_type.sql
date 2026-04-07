-- Add agentType to talk_session
ALTER TABLE "sanotalk_talk_session" ADD COLUMN "agent_type" text;

-- Add linkType to user_link
ALTER TABLE "sanotalk_user_link" ADD COLUMN "link_type" text NOT NULL DEFAULT 'general';

-- Drop old unique index and create new one including link_type
DROP INDEX IF EXISTS "user_link_patient_professional_uniq";
CREATE UNIQUE INDEX "user_link_patient_professional_type_uniq" ON "sanotalk_user_link" ("patient_id", "professional_id", "link_type");
