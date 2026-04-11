DROP INDEX "allergy_user_name_idx";--> statement-breakpoint
DROP INDEX "chronic_condition_user_name_idx";--> statement-breakpoint
ALTER TABLE "sanotalk_allergy" ADD COLUMN "name_hash" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "sanotalk_chronic_condition" ADD COLUMN "name_hash" text DEFAULT '' NOT NULL;--> statement-breakpoint
UPDATE sanotalk_allergy SET name_hash = encode(sha256(lower(trim(name))::bytea), 'hex') WHERE name_hash = '';--> statement-breakpoint
UPDATE sanotalk_chronic_condition SET name_hash = encode(sha256(lower(trim(name))::bytea), 'hex') WHERE name_hash = '';--> statement-breakpoint
CREATE UNIQUE INDEX "allergy_user_name_hash_idx" ON "sanotalk_allergy" USING btree ("user_id","name_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "chronic_condition_user_name_hash_idx" ON "sanotalk_chronic_condition" USING btree ("user_id","name_hash");