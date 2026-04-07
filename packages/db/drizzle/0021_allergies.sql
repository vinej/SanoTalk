CREATE TABLE IF NOT EXISTS "sanotalk_allergy" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" text NOT NULL,
  "type" text NOT NULL,
  "name" text NOT NULL,
  "severity" text NOT NULL,
  "reaction" text,
  "diagnosed_date" date,
  "notes" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

ALTER TABLE "sanotalk_allergy" ADD CONSTRAINT "sanotalk_allergy_user_id_sanotalk_user_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "public"."sanotalk_user"("id") ON DELETE cascade;

CREATE INDEX IF NOT EXISTS "allergy_user_id_idx"
  ON "sanotalk_allergy" USING btree ("user_id");
CREATE UNIQUE INDEX IF NOT EXISTS "allergy_user_name_idx"
  ON "sanotalk_allergy" USING btree ("user_id", "name");

CREATE TABLE IF NOT EXISTS "sanotalk_chronic_condition" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" text NOT NULL,
  "name" text NOT NULL,
  "status" text NOT NULL,
  "severity" text NOT NULL,
  "diagnosed_date" date,
  "medications" text[],
  "notes" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

ALTER TABLE "sanotalk_chronic_condition" ADD CONSTRAINT "sanotalk_chronic_condition_user_id_sanotalk_user_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "public"."sanotalk_user"("id") ON DELETE cascade;

CREATE INDEX IF NOT EXISTS "chronic_condition_user_id_idx"
  ON "sanotalk_chronic_condition" USING btree ("user_id");
CREATE UNIQUE INDEX IF NOT EXISTS "chronic_condition_user_name_idx"
  ON "sanotalk_chronic_condition" USING btree ("user_id", "name");
