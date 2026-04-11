ALTER TABLE "sanotalk_symptom_log" DROP CONSTRAINT "symptom_log_pain_range";--> statement-breakpoint
ALTER TABLE "sanotalk_symptom_log" DROP CONSTRAINT "symptom_log_mood_range";--> statement-breakpoint
ALTER TABLE "sanotalk_symptom_log" DROP CONSTRAINT "symptom_log_energy_range";--> statement-breakpoint
ALTER TABLE "sanotalk_symptom_log" DROP CONSTRAINT "symptom_log_sleep_quality_range";--> statement-breakpoint
ALTER TABLE "sanotalk_symptom_log" DROP CONSTRAINT "symptom_log_sleep_hours_range";--> statement-breakpoint
ALTER TABLE "sanotalk_symptom_log" DROP CONSTRAINT "symptom_log_stress_range";--> statement-breakpoint
ALTER TABLE "sanotalk_symptom_log" DROP CONSTRAINT "symptom_log_appetite_range";--> statement-breakpoint
ALTER TABLE "sanotalk_symptom_log" ALTER COLUMN "pain_level" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "sanotalk_symptom_log" ALTER COLUMN "mood" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "sanotalk_symptom_log" ALTER COLUMN "energy" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "sanotalk_symptom_log" ALTER COLUMN "sleep_quality" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "sanotalk_symptom_log" ALTER COLUMN "sleep_hours" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "sanotalk_symptom_log" ALTER COLUMN "stress" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "sanotalk_symptom_log" ALTER COLUMN "appetite" SET DATA TYPE text;