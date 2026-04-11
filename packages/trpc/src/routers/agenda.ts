import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trcp";
import { agendaEvent, availabilitySlot, medicationSchedule, medication, userLink } from "@sanotalk/db";
import { eq, and, desc, gte, lte } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { encryptContent, decryptContent } from "../lib/crypto";
import { verifyProfessionalFromDb } from "../lib/verify-professional";

const eventTypeEnum = z.enum(["appointment", "exercise", "personal", "birthday", "reservation", "other"]);
const timeRegex = /^\d{2}:\d{2}$/;

// ─── Helpers ────────────────────────────────────────────────────────────────

interface RecurrenceRule {
  freq: "daily" | "weekly" | "monthly";
  daysOfWeek?: number[];
  until?: string;
}

function decryptEventFields<T extends { title: string; description: string | null; location: string | null }>(e: T): T {
  return {
    ...e,
    title: decryptContent(e.title) ?? e.title,
    description: decryptContent(e.description),
    location: decryptContent(e.location),
  };
}

/** Expand a recurring event into virtual occurrences within [from, to]. */
function expandRecurrences(
  event: typeof agendaEvent.$inferSelect,
  from: Date,
  to: Date,
): Array<typeof agendaEvent.$inferSelect & { occurrenceDate: string }> {
  if (!event.recurrenceRule) {
    // Non-recurring: include if in range
    if (event.startAt >= from && event.startAt <= to) {
      return [{ ...event, occurrenceDate: event.startAt.toISOString().slice(0, 10) }];
    }
    return [];
  }

  let rule: RecurrenceRule;
  try {
    rule = JSON.parse(event.recurrenceRule);
  } catch {
    return [];
  }

  const until = rule.until ? new Date(rule.until) : to;
  const end = until < to ? until : to;
  const results: Array<typeof agendaEvent.$inferSelect & { occurrenceDate: string }> = [];

  const cursor = new Date(Math.max(event.startAt.getTime(), from.getTime()));
  // Align cursor to start of day
  cursor.setHours(event.startAt.getHours(), event.startAt.getMinutes(), 0, 0);
  if (cursor < from) cursor.setDate(cursor.getDate() + 1);

  // Safety: max 366 occurrences
  let iterations = 0;
  while (cursor <= end && iterations < 366) {
    iterations++;
    let include = false;

    if (rule.freq === "daily") {
      include = true;
    } else if (rule.freq === "weekly") {
      if (rule.daysOfWeek && rule.daysOfWeek.length > 0) {
        include = rule.daysOfWeek.includes(cursor.getDay());
      } else {
        include = cursor.getDay() === event.startAt.getDay();
      }
    } else if (rule.freq === "monthly") {
      include = cursor.getDate() === event.startAt.getDate();
    }

    if (include && cursor >= from) {
      results.push({
        ...event,
        startAt: new Date(cursor),
        occurrenceDate: cursor.toISOString().slice(0, 10),
      });
    }

    cursor.setDate(cursor.getDate() + 1);
  }

  return results;
}

// ─── Router ─────────────────────────────────────────────────────────────────

export const agendaRouter = createTRPCRouter({
  // ── Events ──────────────────────────────────────────────────────────────

  listEvents: protectedProcedure
    .input(z.object({
      from: z.string().datetime(),
      to: z.string().datetime(),
      eventType: eventTypeEnum.optional(),
    }))
    .query(async ({ ctx, input }) => {
      const fromDate = new Date(input.from);
      const toDate = new Date(input.to);

      const conditions = [eq(agendaEvent.userId, ctx.user.id)];
      if (input.eventType) conditions.push(eq(agendaEvent.eventType, input.eventType));

      // Fetch events that start in range OR have a recurrence rule (could produce occurrences in range)
      const rows = await ctx.db
        .select()
        .from(agendaEvent)
        .where(and(...conditions))
        .orderBy(agendaEvent.startAt)
        .limit(1000);

      // Expand recurrences and filter to range
      const expanded = rows.flatMap(row => expandRecurrences(row, fromDate, toDate));
      return expanded
        .map(decryptEventFields)
        .sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
    }),

  createEvent: protectedProcedure
    .input(z.object({
      title: z.string().min(1).max(200),
      description: z.string().max(500).optional(),
      location: z.string().max(300).optional(),
      startAt: z.string().datetime(),
      endAt: z.string().datetime().optional(),
      allDay: z.boolean().optional(),
      eventType: eventTypeEnum,
      recurrenceRule: z.string().max(500).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const [row] = await ctx.db.insert(agendaEvent).values({
        userId: ctx.user.id,
        eventType: input.eventType,
        title: encryptContent(input.title)!,
        description: encryptContent(input.description ?? null),
        location: encryptContent(input.location ?? null),
        startAt: new Date(input.startAt),
        endAt: input.endAt ? new Date(input.endAt) : null,
        allDay: input.allDay ?? false,
        recurrenceRule: input.recurrenceRule ?? null,
      }).returning({ id: agendaEvent.id });
      return { id: row!.id };
    }),

  updateEvent: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      title: z.string().min(1).max(200).optional(),
      description: z.string().max(500).nullable().optional(),
      location: z.string().max(300).nullable().optional(),
      startAt: z.string().datetime().optional(),
      endAt: z.string().datetime().nullable().optional(),
      allDay: z.boolean().optional(),
      recurrenceRule: z.string().max(500).nullable().optional(),
      color: z.string().max(20).nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...fields } = input;
      const values: Record<string, unknown> = { updatedAt: new Date() };
      if (fields.title !== undefined) values.title = encryptContent(fields.title);
      if (fields.description !== undefined) values.description = encryptContent(fields.description);
      if (fields.location !== undefined) values.location = encryptContent(fields.location);
      if (fields.startAt !== undefined) values.startAt = new Date(fields.startAt);
      if (fields.endAt !== undefined) values.endAt = fields.endAt ? new Date(fields.endAt) : null;
      if (fields.allDay !== undefined) values.allDay = fields.allDay;
      if (fields.recurrenceRule !== undefined) values.recurrenceRule = fields.recurrenceRule;
      if (fields.color !== undefined) values.color = fields.color;

      const updated = await ctx.db
        .update(agendaEvent)
        .set(values)
        .where(and(eq(agendaEvent.id, id), eq(agendaEvent.userId, ctx.user.id)))
        .returning({ id: agendaEvent.id });
      if (updated.length === 0) throw new TRPCError({ code: "NOT_FOUND" });
      return { id: updated[0]!.id };
    }),

  deleteEvent: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const deleted = await ctx.db
        .delete(agendaEvent)
        .where(and(eq(agendaEvent.id, input.id), eq(agendaEvent.userId, ctx.user.id)))
        .returning({ id: agendaEvent.id });
      if (deleted.length === 0) throw new TRPCError({ code: "NOT_FOUND" });
      return { deleted: true };
    }),

  // ── Today Overview ────────────────────────────────────────────────────

  todayOverview: protectedProcedure
    .query(async ({ ctx }) => {
      const now = new Date();
      const startOfDay = new Date(now);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(now);
      endOfDay.setHours(23, 59, 59, 999);

      // 1. User events (expanded for recurrence)
      const events = await ctx.db
        .select()
        .from(agendaEvent)
        .where(eq(agendaEvent.userId, ctx.user.id));

      const todayEvents = events
        .flatMap(e => expandRecurrences(e, startOfDay, endOfDay))
        .map(e => ({
          type: e.eventType as "appointment" | "exercise",
          time: e.startAt.toISOString().slice(11, 16),
          title: decryptContent(e.title) ?? e.title,
          subtitle: decryptContent(e.description) ?? null,
          id: e.id,
        }));

      // 2. Medication reminders
      const todayStr = now.toISOString().slice(0, 10);
      const meds = await ctx.db
        .select({
          scheduleId: medicationSchedule.id,
          timeOfDay: medicationSchedule.timeOfDay,
          label: medicationSchedule.label,
          medName: medication.name,
          medDosage: medication.dosage,
          medStartDate: medication.startDate,
          medEndDate: medication.endDate,
          medIsActive: medication.isActive,
        })
        .from(medicationSchedule)
        .innerJoin(medication, eq(medicationSchedule.medicationId, medication.id))
        .where(and(
          eq(medicationSchedule.userId, ctx.user.id),
          eq(medicationSchedule.isActive, true),
          eq(medication.isActive, true),
        ));

      const medReminders = meds
        .filter(m => {
          const start = m.medStartDate.toISOString().slice(0, 10);
          if (start > todayStr) return false;
          if (m.medEndDate) {
            const end = m.medEndDate.toISOString().slice(0, 10);
            if (end < todayStr) return false;
          }
          return true;
        })
        .map(m => ({
          type: "medication" as const,
          time: m.timeOfDay,
          title: decryptContent(m.medName) ?? m.medName,
          subtitle: [decryptContent(m.medDosage), decryptContent(m.label)].filter(Boolean).join(" — ") || null,
          id: m.scheduleId,
        }));

      // Merge and sort by time
      const timeline = [...todayEvents, ...medReminders].sort((a, b) => a.time.localeCompare(b.time));
      return timeline;
    }),

  // ── Medication Schedule ───────────────────────────────────────────────

  listMedicationReminders: protectedProcedure
    .input(z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }))
    .query(async ({ ctx, input }) => {
      const meds = await ctx.db
        .select({
          scheduleId: medicationSchedule.id,
          medicationId: medicationSchedule.medicationId,
          timeOfDay: medicationSchedule.timeOfDay,
          label: medicationSchedule.label,
          medName: medication.name,
          medDosage: medication.dosage,
          medStartDate: medication.startDate,
          medEndDate: medication.endDate,
        })
        .from(medicationSchedule)
        .innerJoin(medication, eq(medicationSchedule.medicationId, medication.id))
        .where(and(
          eq(medicationSchedule.userId, ctx.user.id),
          eq(medicationSchedule.isActive, true),
          eq(medication.isActive, true),
        ))
        .orderBy(medicationSchedule.timeOfDay);

      return meds
        .filter(m => {
          const start = m.medStartDate.toISOString().slice(0, 10);
          if (start > input.date) return false;
          if (m.medEndDate) {
            const end = m.medEndDate.toISOString().slice(0, 10);
            if (end < input.date) return false;
          }
          return true;
        })
        .map(m => ({
          scheduleId: m.scheduleId,
          medicationId: m.medicationId,
          timeOfDay: m.timeOfDay,
          label: decryptContent(m.label),
          medicationName: decryptContent(m.medName) ?? m.medName,
          dosage: decryptContent(m.medDosage) ?? m.medDosage,
        }));
    }),

  setMedicationSchedule: protectedProcedure
    .input(z.object({
      medicationId: z.string().uuid(),
      times: z.array(z.object({
        timeOfDay: z.string().regex(timeRegex),
        label: z.string().max(100).optional(),
      })).max(10),
    }))
    .mutation(async ({ ctx, input }) => {
      // Verify medication belongs to user
      const med = await ctx.db
        .select({ id: medication.id })
        .from(medication)
        .where(and(eq(medication.id, input.medicationId), eq(medication.userId, ctx.user.id)));
      if (med.length === 0) throw new TRPCError({ code: "NOT_FOUND" });

      // Replace all schedules for this medication
      await ctx.db
        .delete(medicationSchedule)
        .where(and(
          eq(medicationSchedule.medicationId, input.medicationId),
          eq(medicationSchedule.userId, ctx.user.id),
        ));

      if (input.times.length > 0) {
        await ctx.db.insert(medicationSchedule).values(
          input.times.map(t => ({
            medicationId: input.medicationId,
            userId: ctx.user.id,
            timeOfDay: t.timeOfDay,
            label: encryptContent(t.label ?? null),
          })),
        );
      }

      return { count: input.times.length };
    }),

  // ── Availability ──────────────────────────────────────────────────────

  listAvailability: protectedProcedure
    .input(z.object({
      professionalId: z.string(),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    }))
    .query(async ({ ctx, input }) => {
      // Verify patient has a link with this professional
      const link = await ctx.db.query.userLink.findFirst({
        where: and(
          eq(userLink.patientId, ctx.user.id),
          eq(userLink.professionalId, input.professionalId),
        ),
      });
      if (!link) throw new TRPCError({ code: "FORBIDDEN", message: "Not linked to this professional" });

      const d = new Date(input.date + "T12:00:00");
      const dayOfWeek = d.getDay();

      const slots = await ctx.db
        .select()
        .from(availabilitySlot)
        .where(and(
          eq(availabilitySlot.professionalId, input.professionalId),
          eq(availabilitySlot.dayOfWeek, dayOfWeek),
          eq(availabilitySlot.isActive, true),
        ))
        .orderBy(availabilitySlot.startTime);

      return slots.map(s => ({
        id: s.id,
        startTime: s.startTime,
        endTime: s.endTime,
        slotDurationMins: s.slotDurationMins,
      }));
    }),

  setAvailability: protectedProcedure
    .input(z.object({
      slots: z.array(z.object({
        dayOfWeek: z.number().int().min(0).max(6),
        startTime: z.string().regex(timeRegex),
        endTime: z.string().regex(timeRegex),
        slotDurationMins: z.number().int().min(10).max(120).optional(),
      })).max(28), // max 4 slots per day × 7 days
    }))
    .mutation(async ({ ctx, input }) => {
      const isProfessional = await verifyProfessionalFromDb(ctx.db, ctx.user.id);
      if (!isProfessional) throw new TRPCError({ code: "FORBIDDEN", message: "Only doctors and pharmacists can set availability" });

      // Replace all slots
      await ctx.db
        .delete(availabilitySlot)
        .where(eq(availabilitySlot.professionalId, ctx.user.id));

      if (input.slots.length > 0) {
        await ctx.db.insert(availabilitySlot).values(
          input.slots.map(s => ({
            professionalId: ctx.user.id,
            dayOfWeek: s.dayOfWeek,
            startTime: s.startTime,
            endTime: s.endTime,
            slotDurationMins: s.slotDurationMins ?? 30,
          })),
        );
      }

      return { count: input.slots.length };
    }),

  getMyAvailability: protectedProcedure
    .query(async ({ ctx }) => {
      const isProfessional = await verifyProfessionalFromDb(ctx.db, ctx.user.id);
      if (!isProfessional) throw new TRPCError({ code: "FORBIDDEN", message: "Only doctors and pharmacists can view their availability" });

      const slots = await ctx.db
        .select()
        .from(availabilitySlot)
        .where(eq(availabilitySlot.professionalId, ctx.user.id))
        .orderBy(availabilitySlot.dayOfWeek, availabilitySlot.startTime);

      return slots.map(s => ({
        id: s.id,
        dayOfWeek: s.dayOfWeek,
        startTime: s.startTime,
        endTime: s.endTime,
        slotDurationMins: s.slotDurationMins,
        isActive: s.isActive,
      }));
    }),
});
