-- Create professional links table (patient ↔ doctor/pharmacist)
CREATE TABLE "sanotalk_user_link" (
  "id"              uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "patient_id"      text NOT NULL REFERENCES "sanotalk_user"("id") ON DELETE CASCADE,
  "professional_id" text NOT NULL REFERENCES "sanotalk_user"("id") ON DELETE CASCADE,
  "created_at"      timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX "user_link_patient_professional_uniq"
  ON "sanotalk_user_link" ("patient_id","professional_id");

-- Create friends table (any role, directional)
CREATE TABLE "sanotalk_user_friend" (
  "id"         uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id"    text NOT NULL REFERENCES "sanotalk_user"("id") ON DELETE CASCADE,
  "friend_id"  text NOT NULL REFERENCES "sanotalk_user"("id") ON DELETE CASCADE,
  "created_at" timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX "user_friend_uniq"
  ON "sanotalk_user_friend" ("user_id","friend_id");

-- Migrate existing single-link data into the new join table
INSERT INTO "sanotalk_user_link" ("patient_id","professional_id")
SELECT "id", "linked_doctor_id"
FROM "sanotalk_user"
WHERE "linked_doctor_id" IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO "sanotalk_user_link" ("patient_id","professional_id")
SELECT "id", "linked_pharmacist_id"
FROM "sanotalk_user"
WHERE "linked_pharmacist_id" IS NOT NULL
ON CONFLICT DO NOTHING;

-- Drop old single-link columns
ALTER TABLE "sanotalk_user" DROP COLUMN "linked_doctor_id";
ALTER TABLE "sanotalk_user" DROP COLUMN "linked_pharmacist_id";
