import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trcp";
import { symptomLog, user, userLink, task } from "@sanotalk/db";
import { resend } from "../lib/resend";
import { escapeHtml, sanitizeSubject } from "../lib/escape-html";
import { eq, and, desc, gte, lte } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { encryptContent, decryptContent, encryptArray, decryptArray, encryptNumeric, decryptNumeric } from "../lib/crypto";
import { checkDailyShareLimit } from "../lib/share-limit";
import { logAuditEvent, requestMeta } from "../lib/audit";

function decryptSymptomFields<T extends Record<string, any>>(s: T) {
  return {
    ...s,
    painLevel: decryptNumeric(s.painLevel),
    mood: decryptNumeric(s.mood),
    energy: decryptNumeric(s.energy),
    sleepQuality: decryptNumeric(s.sleepQuality),
    sleepHours: decryptNumeric(s.sleepHours),
    stress: decryptNumeric(s.stress),
    appetite: decryptNumeric(s.appetite),
    customSymptoms: decryptArray(s.customSymptoms),
    bodyLocation: decryptContent(s.bodyLocation),
    notes: decryptContent(s.notes),
  };
}

export const symptomsRouter = createTRPCRouter({
  log: protectedProcedure
    .input(z.object({
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      painLevel: z.number().int().min(0).max(10).nullable().optional(),
      mood: z.number().int().min(1).max(10).nullable().optional(),
      energy: z.number().int().min(1).max(10).nullable().optional(),
      sleepQuality: z.number().int().min(1).max(10).nullable().optional(),
      sleepHours: z.number().min(0).max(24).nullable().optional(),
      stress: z.number().int().min(1).max(10).nullable().optional(),
      appetite: z.number().int().min(1).max(10).nullable().optional(),
      customSymptoms: z.array(z.string().max(100)).max(20).optional(),
      bodyLocation: z.string().max(200).nullable().optional(),
      notes: z.string().max(500).nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const encCustomSymptoms = encryptArray(input.customSymptoms ?? null);
      const encBodyLocation = encryptContent(input.bodyLocation ?? null);
      const encNotes = encryptContent(input.notes ?? null);

      const values = {
        userId: ctx.user.id,
        date: input.date,
        painLevel: encryptNumeric(input.painLevel ?? null),
        mood: encryptNumeric(input.mood ?? null),
        energy: encryptNumeric(input.energy ?? null),
        sleepQuality: encryptNumeric(input.sleepQuality ?? null),
        sleepHours: encryptNumeric(input.sleepHours ?? null),
        stress: encryptNumeric(input.stress ?? null),
        appetite: encryptNumeric(input.appetite ?? null),
        customSymptoms: encCustomSymptoms,
        bodyLocation: encBodyLocation,
        notes: encNotes,
      };

      const [row] = await ctx.db
        .insert(symptomLog)
        .values(values)
        .onConflictDoUpdate({
          target: [symptomLog.userId, symptomLog.date],
          set: {
            painLevel: values.painLevel,
            mood: values.mood,
            energy: values.energy,
            sleepQuality: values.sleepQuality,
            sleepHours: values.sleepHours,
            stress: values.stress,
            appetite: values.appetite,
            customSymptoms: values.customSymptoms,
            bodyLocation: values.bodyLocation,
            notes: values.notes,
            updatedAt: new Date(),
          },
        })
        .returning({ id: symptomLog.id, date: symptomLog.date, painLevel: symptomLog.painLevel, mood: symptomLog.mood, energy: symptomLog.energy, sleepQuality: symptomLog.sleepQuality, sleepHours: symptomLog.sleepHours, stress: symptomLog.stress, appetite: symptomLog.appetite, customSymptoms: symptomLog.customSymptoms, bodyLocation: symptomLog.bodyLocation, notes: symptomLog.notes, createdAt: symptomLog.createdAt, updatedAt: symptomLog.updatedAt });
      return decryptSymptomFields(row!);
    }),

  list: protectedProcedure
    .input(z.object({
      from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      limit: z.number().min(1).max(500).optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      const conditions = [eq(symptomLog.userId, ctx.user.id)];
      if (input?.from) conditions.push(gte(symptomLog.date, input.from));
      if (input?.to) conditions.push(lte(symptomLog.date, input.to));

      const rows = await ctx.db
        .select()
        .from(symptomLog)
        .where(and(...conditions))
        .orderBy(desc(symptomLog.date))
        .limit(input?.limit ?? 90);
      return rows.map(decryptSymptomFields);
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const deleted = await ctx.db
        .delete(symptomLog)
        .where(and(eq(symptomLog.id, input.id), eq(symptomLog.userId, ctx.user.id)))
        .returning({ id: symptomLog.id });
      if (deleted.length === 0) throw new TRPCError({ code: "NOT_FOUND" });
      return { deleted: true };
    }),

  shareWithProfessional: protectedProcedure
    .input(z.object({
      recipientUserId: z.string().min(1).max(100),
      language: z.enum(["en", "fr", "es", "zh", "ar", "hi"]).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await checkDailyShareLimit(ctx.db, ctx.user.id);
      const sender = await ctx.db.query.user.findFirst({
        where: eq(user.id, ctx.user.id),
        columns: { id: true, name: true, role: true },
      });
      if (!sender || (sender as any).role !== "patient") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only patients can share symptoms" });
      }

      const link = await ctx.db.query.userLink.findFirst({
        where: and(eq(userLink.patientId, ctx.user.id), eq(userLink.professionalId, input.recipientUserId)),
      });
      if (!link) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Recipient is not linked to this patient" });
      }

      const recipient = await ctx.db.query.user.findFirst({
        where: eq(user.id, input.recipientUserId),
        columns: { id: true, name: true, email: true, role: true },
      });
      if (!recipient) throw new TRPCError({ code: "NOT_FOUND" });
      if ((recipient as any).role !== "doctor" && (recipient as any).role !== "pharmacist") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Recipient must be a doctor or pharmacist" });
      }

      const lang = input.language ?? "en";
      const safeName = sender.name.replace(/[<>"'&\x00-\x1F]/g, "").slice(0, 100).trim() || "Unknown";
      const taskTitleByLang: Record<string, string> = {
        en: `Review symptom journal for patient ${safeName}`,
        fr: `Consulter le journal des symptômes du patient ${safeName}`,
        es: `Revisar el diario de síntomas del paciente ${safeName}`,
        zh: `查看患者 ${safeName} 的症状日记`,
        ar: `مراجعة مذكرة أعراض المريض ${safeName}`,
        hi: `मरीज़ ${safeName} की लक्षण डायरी देखें`,
      };
      const taskTitle = taskTitleByLang[lang] ?? taskTitleByLang["en"]!;

      const from = process.env.EMAIL_FROM ?? "onboarding@resend.dev";
      const appUrl = process.env.APP_URL ?? "";
      const symptomsUrl = `${appUrl}/symptoms`;

      await resend.emails.send({
        from,
        to: recipient.email,
        subject: `SanoTalk — Symptom journal shared by ${sanitizeSubject(sender.name)}`,
        html: `
          <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
            <h2 style="color:#1a1a1a">Symptom Journal Shared</h2>
            <p style="color:#555"><strong>${escapeHtml(sender.name)}</strong> has shared their symptom journal with you.</p>
            <hr style="border:none;border-top:1px solid #eee;margin:16px 0"/>
            <p style="color:#333">For security and privacy reasons, medical details are not included in this email.</p>
            <p>
              <a href="${escapeHtml(symptomsUrl)}" style="display:inline-block;padding:12px 24px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px;font-weight:600">
                View Symptom Journal
              </a>
            </p>
            <p style="color:#999;font-size:12px;margin-top:24px">
              You must be logged in to SanoTalk to view the data.
            </p>
            <hr style="border:none;border-top:1px solid #eee;margin:16px 0"/>
            <p style="color:#999;font-size:11px">Sent from SanoTalk.</p>
          </div>
        `,
      });

      await ctx.db.insert(task).values({
        title: taskTitle,
        description: symptomsUrl,
        status: "assigned",
        assignedUserId: recipient.id,
        taskType: "summary_review",
      });

      void logAuditEvent(ctx.db, {
        userId: ctx.user.id, action: "share_data", targetUserId: input.recipientUserId,
        resourceType: "symptom_log", metadata: { shareType: "symptoms" },
        ...requestMeta(ctx.req),
      });

      return { sent: true };
    }),
});
