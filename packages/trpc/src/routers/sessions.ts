import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trcp";
import { talkSession } from "@sanotalk/db";
import { eq, desc } from "drizzle-orm";
import { nanoid } from "nanoid";

export const sessionsRouter = createTRPCRouter({
  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.query.talkSession.findMany({
      orderBy: [desc(talkSession.createdAt)],
      with: {
        participants: { with: { user: true } },
      },
    });
  }),

  byId: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const result = await ctx.db.query.talkSession.findFirst({
        where: eq(talkSession.id, input.id),
        with: {
          participants: { with: { user: true } },
        },
      });
      if (!result) throw new Error("Session not found");
      return result
    }),

  create: protectedProcedure
    .input(
      z.object({
        scheduledAt: z.string().datetime().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const roomName = `sanotalk-${nanoid(10)}`;
      const [created] = await ctx.db
        .insert(talkSession)
        .values({
          roomName,
          hostId: ctx.user.id,
          scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,
        }
        )

        .returning();

      return created;
    }),

  start: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(talkSession)
        .set({ status: "active", startedAt: new Date() })
        .where(eq(talkSession.id, input.id))
        .returning();
      return updated;
    }),

  end: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(talkSession)
        .set({ status: "completed", endedAt: new Date() })
        .where(eq(talkSession.id, input.id))
        .returning();
      return updated;
    }),
});
