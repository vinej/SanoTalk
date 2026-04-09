ALTER TABLE "sanotalk_user" ADD COLUMN "approved" boolean NOT NULL DEFAULT false;--> statement-breakpoint
UPDATE "sanotalk_user" SET "approved" = true;
