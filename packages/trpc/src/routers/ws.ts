import { createTRPCRouter, protectedProcedure } from "../trcp";
import { issueTicket } from "../lib/ws-tickets";

export const wsRouter = createTRPCRouter({
  getTicket: protectedProcedure.mutation(async ({ ctx }) => {
    const ticket = issueTicket(ctx.user.id);
    return { ticket };
  }),
});
