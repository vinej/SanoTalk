ALTER TABLE "sanotalk_user" ALTER COLUMN "two_factor_enabled" SET DEFAULT true;
--> statement-breakpoint
UPDATE "sanotalk_user" SET "two_factor_enabled" = true WHERE "two_factor_enabled" = false;