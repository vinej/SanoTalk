import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trcp";
import { vitalSign, user, userLink, task } from "@sanotalk/db";
import { resend } from "../lib/resend";
import { escapeHtml, sanitizeSubject } from "../lib/escape-html";
import { eq, and, desc, gte, lte, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

const vitalTypeEnum = z.enum([
  "blood_pressure", "heart_rate", "weight",
  "blood_glucose", "temperature", "oxygen_saturation",
]);

// ── Alert thresholds ────────────────────────────────────────────────────────

interface AlertThreshold {
  high?: number;
  low?: number;
  highSecondary?: number;
  lowSecondary?: number;
}

const THRESHOLDS: Record<string, AlertThreshold> = {
  blood_pressure:     { high: 140, low: 90, highSecondary: 90, lowSecondary: 60 },
  heart_rate:         { high: 100, low: 50 },
  blood_glucose:      { high: 180, low: 70 },
  temperature:        { high: 38.5, low: 35 },
  oxygen_saturation:  { low: 94 },
};

function checkAlert(type: string, primary: number, secondary?: number | null): string | null {
  const t = THRESHOLDS[type];
  if (!t) return null;

  if (t.high !== undefined && primary > t.high) return "high";
  if (t.low !== undefined && primary < t.low) return "low";
  if (secondary != null) {
    if (t.highSecondary !== undefined && secondary > t.highSecondary) return "high";
    if (t.lowSecondary !== undefined && secondary < t.lowSecondary) return "low";
  }
  return null;
}

// ── Router ──────────────────────────────────────────────────────────────────

export const vitalsRouter = createTRPCRouter({
  log: protectedProcedure
    .input(z.object({
      type: vitalTypeEnum,
      valuePrimary: z.number(),
      valueSecondary: z.number().nullable().optional(),
      unit: z.string().min(1).max(50),
      notes: z.string().max(500).optional(),
      measuredAt: z.string().datetime().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const measuredAt = input.measuredAt ? new Date(input.measuredAt) : new Date();
      const [row] = await ctx.db.insert(vitalSign).values({
        userId: ctx.user.id,
        type: input.type,
        valuePrimary: input.valuePrimary,
        valueSecondary: input.valueSecondary ?? null,
        unit: input.unit,
        notes: input.notes ?? null,
        source: "manual",
        measuredAt,
      }).returning({ id: vitalSign.id });

      const alert = checkAlert(input.type, input.valuePrimary, input.valueSecondary);
      return { id: row!.id, alert };
    }),

  list: protectedProcedure
    .input(z.object({
      type: vitalTypeEnum.optional(),
      from: z.string().datetime().optional(),
      to: z.string().datetime().optional(),
      limit: z.number().min(1).max(500).optional(),
    }))
    .query(async ({ ctx, input }) => {
      const conditions = [eq(vitalSign.userId, ctx.user.id)];
      if (input.type) conditions.push(eq(vitalSign.type, input.type));
      if (input.from) conditions.push(gte(vitalSign.measuredAt, new Date(input.from)));
      if (input.to) conditions.push(lte(vitalSign.measuredAt, new Date(input.to)));

      return ctx.db
        .select()
        .from(vitalSign)
        .where(and(...conditions))
        .orderBy(desc(vitalSign.measuredAt))
        .limit(input.limit ?? 200);
    }),

  latest: protectedProcedure
    .query(async ({ ctx }) => {
      // Get latest reading per type using a subquery approach
      const types = ["blood_pressure", "heart_rate", "weight", "blood_glucose", "temperature", "oxygen_saturation"] as const;
      const results: Record<string, typeof vitalSign.$inferSelect | null> = {};

      const rows = await ctx.db
        .select()
        .from(vitalSign)
        .where(eq(vitalSign.userId, ctx.user.id))
        .orderBy(desc(vitalSign.measuredAt))
        .limit(100);

      for (const t of types) {
        results[t] = rows.find(r => r.type === t) ?? null;
      }
      return results;
    }),

  stats: protectedProcedure
    .input(z.object({
      type: vitalTypeEnum,
      from: z.string().datetime(),
      to: z.string().datetime(),
    }))
    .query(async ({ ctx, input }) => {
      const fromDate = new Date(input.from);
      const toDate = new Date(input.to);
      if (fromDate >= toDate) throw new TRPCError({ code: "BAD_REQUEST", message: "from must be before to" });
      if (toDate.getTime() - fromDate.getTime() > 366 * 24 * 60 * 60 * 1000) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Date range exceeds maximum of 1 year" });
      }
      const [result] = await ctx.db
        .select({
          avg: sql<number>`avg(${vitalSign.valuePrimary})`,
          min: sql<number>`min(${vitalSign.valuePrimary})`,
          max: sql<number>`max(${vitalSign.valuePrimary})`,
          count: sql<number>`count(*)`,
        })
        .from(vitalSign)
        .where(and(
          eq(vitalSign.userId, ctx.user.id),
          eq(vitalSign.type, input.type),
          gte(vitalSign.measuredAt, fromDate),
          lte(vitalSign.measuredAt, toDate),
        ));

      return result ?? { avg: 0, min: 0, max: 0, count: 0 };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [row] = await ctx.db
        .select({ userId: vitalSign.userId })
        .from(vitalSign)
        .where(eq(vitalSign.id, input.id));

      if (!row || row.userId !== ctx.user.id) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      await ctx.db.delete(vitalSign).where(eq(vitalSign.id, input.id));
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
        throw new TRPCError({ code: "FORBIDDEN", message: "Only patients can share vitals" });
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
        en: `Review vital signs for patient ${sender.name}`,
        fr: `Consulter les signes vitaux du patient ${sender.name}`,
        es: `Revisar signos vitales del paciente ${sender.name}`,
        zh: `查看患者 ${sender.name} 的生命体征`,
        ar: `مراجعة العلامات الحيوية للمريض ${sender.name}`,
        hi: `मरीज़ ${sender.name} के जीवन संकेत देखें`,
      };
      const taskTitle = taskTitleByLang[lang] ?? taskTitleByLang["en"]!;

      const from = process.env.EMAIL_FROM ?? "onboarding@resend.dev";
      const appUrl = process.env.APP_URL ?? "";
      const vitalsUrl = `${appUrl}/vitals`;

      await resend.emails.send({
        from,
        to: recipient.email,
        subject: `SanoTalk — Vital signs shared by ${sanitizeSubject(sender.name)}`,
        html: `
          <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
            <h2 style="color:#1a1a1a">Vital Signs Shared</h2>
            <p style="color:#555"><strong>${escapeHtml(sender.name)}</strong> has shared their vital signs with you.</p>
            <hr style="border:none;border-top:1px solid #eee;margin:16px 0"/>
            <p style="color:#333">For security and privacy reasons, medical details are not included in this email.</p>
            <p>
              <a href="${escapeHtml(vitalsUrl)}" style="display:inline-block;padding:12px 24px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px;font-weight:600">
                View Vital Signs
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
        description: vitalsUrl,
        status: "assigned",
        assignedUserId: recipient.id,
        taskType: "summary_review",
      });

      return { sent: true };
    }),
});
