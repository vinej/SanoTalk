import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trcp";
import { medication, user, userLink, task } from "@sanotalk/db";
import { resend } from "../lib/resend";
import { escapeHtml, sanitizeSubject } from "../lib/escape-html";
import { eq, and, desc } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

export const medicationsRouter = createTRPCRouter({
  add: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(200),
      dosage: z.string().min(1).max(100),
      frequency: z.string().min(1).max(100),
      route: z.string().max(100).optional(),
      prescribedBy: z.string().max(200).optional(),
      reason: z.string().max(300).optional(),
      startDate: z.string().datetime(),
      endDate: z.string().datetime().nullable().optional(),
      notes: z.string().max(500).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const [row] = await ctx.db.insert(medication).values({
        userId: ctx.user.id,
        name: input.name,
        dosage: input.dosage,
        frequency: input.frequency,
        route: input.route ?? null,
        prescribedBy: input.prescribedBy ?? null,
        reason: input.reason ?? null,
        startDate: new Date(input.startDate),
        endDate: input.endDate ? new Date(input.endDate) : null,
        isActive: true,
        notes: input.notes ?? null,
      }).returning({ id: medication.id, name: medication.name, dosage: medication.dosage, frequency: medication.frequency, route: medication.route, prescribedBy: medication.prescribedBy, reason: medication.reason, startDate: medication.startDate, endDate: medication.endDate, isActive: medication.isActive, notes: medication.notes, createdAt: medication.createdAt, updatedAt: medication.updatedAt });
      return row!;
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      name: z.string().min(1).max(200).optional(),
      dosage: z.string().min(1).max(100).optional(),
      frequency: z.string().min(1).max(100).optional(),
      route: z.string().max(100).nullable().optional(),
      prescribedBy: z.string().max(200).nullable().optional(),
      reason: z.string().max(300).nullable().optional(),
      startDate: z.string().datetime().optional(),
      endDate: z.string().datetime().nullable().optional(),
      isActive: z.boolean().optional(),
      notes: z.string().max(500).nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...fields } = input;
      const values: Record<string, unknown> = { updatedAt: new Date() };
      if (fields.name !== undefined) values.name = fields.name;
      if (fields.dosage !== undefined) values.dosage = fields.dosage;
      if (fields.frequency !== undefined) values.frequency = fields.frequency;
      if (fields.route !== undefined) values.route = fields.route;
      if (fields.prescribedBy !== undefined) values.prescribedBy = fields.prescribedBy;
      if (fields.reason !== undefined) values.reason = fields.reason;
      if (fields.startDate !== undefined) values.startDate = new Date(fields.startDate);
      if (fields.endDate !== undefined) values.endDate = fields.endDate ? new Date(fields.endDate) : null;
      if (fields.isActive !== undefined) values.isActive = fields.isActive;
      if (fields.notes !== undefined) values.notes = fields.notes;

      const [updated] = await ctx.db
        .update(medication)
        .set(values)
        .where(and(eq(medication.id, id), eq(medication.userId, ctx.user.id)))
        .returning({ id: medication.id, name: medication.name, dosage: medication.dosage, frequency: medication.frequency, route: medication.route, prescribedBy: medication.prescribedBy, reason: medication.reason, startDate: medication.startDate, endDate: medication.endDate, isActive: medication.isActive, notes: medication.notes, createdAt: medication.createdAt, updatedAt: medication.updatedAt });
      if (!updated) throw new TRPCError({ code: "NOT_FOUND" });
      return updated;
    }),

  list: protectedProcedure
    .input(z.object({
      activeOnly: z.boolean().optional(),
      limit: z.number().min(1).max(500).optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      const conditions = [eq(medication.userId, ctx.user.id)];
      if (input?.activeOnly) conditions.push(eq(medication.isActive, true));

      return ctx.db
        .select()
        .from(medication)
        .where(and(...conditions))
        .orderBy(desc(medication.isActive), desc(medication.startDate))
        .limit(input?.limit ?? 100);
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const deleted = await ctx.db
        .delete(medication)
        .where(and(eq(medication.id, input.id), eq(medication.userId, ctx.user.id)))
        .returning({ id: medication.id });
      if (deleted.length === 0) throw new TRPCError({ code: "NOT_FOUND" });
      return { deleted: true };
    }),

  shareWithProfessional: protectedProcedure
    .input(z.object({
      recipientUserId: z.string().min(1).max(100),
      language: z.enum(["en", "fr", "es", "zh", "ar", "hi"]).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const sender = await ctx.db.query.user.findFirst({
        where: eq(user.id, ctx.user.id),
        columns: { id: true, name: true, role: true },
      });
      if (!sender || (sender as any).role !== "patient") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only patients can share medications" });
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
      const taskTitleByLang: Record<string, string> = {
        en: `Review medications for patient ${sender.name}`,
        fr: `Consulter les médicaments du patient ${sender.name}`,
        es: `Revisar medicamentos del paciente ${sender.name}`,
        zh: `查看患者 ${sender.name} 的药物`,
        ar: `مراجعة أدوية المريض ${sender.name}`,
        hi: `मरीज़ ${sender.name} की दवाइयाँ देखें`,
      };
      const taskTitle = taskTitleByLang[lang] ?? taskTitleByLang["en"]!;

      const from = process.env.EMAIL_FROM ?? "onboarding@resend.dev";
      const appUrl = process.env.APP_URL ?? "";
      const medsUrl = `${appUrl}/medications`;

      await resend.emails.send({
        from,
        to: recipient.email,
        subject: `SanoTalk — Medications shared by ${sanitizeSubject(sender.name)}`,
        html: `
          <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
            <h2 style="color:#1a1a1a">Medications Shared</h2>
            <p style="color:#555"><strong>${escapeHtml(sender.name)}</strong> has shared their medication list with you.</p>
            <hr style="border:none;border-top:1px solid #eee;margin:16px 0"/>
            <p style="color:#333">For security and privacy reasons, medical details are not included in this email.</p>
            <p>
              <a href="${escapeHtml(medsUrl)}" style="display:inline-block;padding:12px 24px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px;font-weight:600">
                View Medications
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
        description: medsUrl,
        status: "assigned",
        assignedUserId: recipient.id,
        taskType: "summary_review",
      });

      return { sent: true };
    }),
});
