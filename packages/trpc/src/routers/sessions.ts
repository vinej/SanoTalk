import { z } from "zod";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "../trcp";
import { talkSession, sessionParticipant } from "@sanotalk/db";
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
        .values(
          {
          roomName: roomName? roomName : 'undefined',
          hostId: ctx.user.id? ctx.user.id : 'undefined'
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
        .set({ hostId: input.id })
        .where(eq(talkSession.id, input.id))
        .returning();
      return updated;
    }),

  end: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(talkSession)
        .set({ hostId: input.id })
        .where(eq(talkSession.id, input.id))
        .returning();
      return updated;
    }),
});
