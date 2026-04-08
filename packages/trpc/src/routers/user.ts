import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trcp";
import { user, userProperty, userLink, userFriend, connectionRequest, aiAssistantProfile } from "@sanotalk/db";
import { eq, and, desc, inArray } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { verifyAdminFromDb } from "../lib/verify-admin";
import { getRelatedUserIds } from "../lib/related-users";
import { encrypt, decrypt, ENCRYPTED_KEYS } from "../lib/crypto";

export const userRouter = createTRPCRouter({
  profile: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.query.user.findFirst({
      where: eq(user.id, ctx.user.id),
      columns: {
        id: true, name: true, email: true, image: true, role: true,
        specialty: true, licenseNumber: true, propertiesLanguage: true, createdAt: true,
      },
    });
  }),

  listByRole: protectedProcedure
    .input(z.object({ role: z.enum(["doctor", "pharmacist", "patient"]) }))
    .query(async ({ ctx, input }) => {
      const isAdmin = await verifyAdminFromDb(ctx.db, ctx.user.id);
      if (isAdmin) {
        return ctx.db.query.user.findMany({
          where: eq(user.role, input.role),
          columns: { id: true, name: true, specialty: true, role: true },
        });
      }
      const relatedIds = await getRelatedUserIds(ctx.db, ctx.user.id);
      if (relatedIds.size === 0) return [];
      return ctx.db.query.user.findMany({
        where: and(eq(user.role, input.role), inArray(user.id, [...relatedIds])),
        columns: { id: true, name: true, specialty: true, role: true },
      });
    }),

  listAll: protectedProcedure.query(async ({ ctx }) => {
    const isAdmin = await verifyAdminFromDb(ctx.db, ctx.user.id);
    if (isAdmin) {
      return ctx.db.query.user.findMany({
        columns: { id: true, name: true, role: true },
      });
    }
    const relatedIds = await getRelatedUserIds(ctx.db, ctx.user.id);
    if (relatedIds.size === 0) return [];
    return ctx.db.query.user.findMany({
      where: inArray(user.id, [...relatedIds]),
      columns: { id: true, name: true, role: true },
    });
  }),

  listAiAssistants: protectedProcedure.query(async ({ ctx }) => {
    const profiles = await ctx.db.query.aiAssistantProfile.findMany({
      where: eq(aiAssistantProfile.isActive, true),
      with: { user: { columns: { id: true, name: true, image: true, role: true } } },
    });
    return profiles.map((p) => ({
      id: p.user.id,
      name: p.user.name,
      image: p.user.image,
      role: p.user.role,
      type: p.type,
      gender: p.gender,
      personality: p.personality,
    }));
  }),

  update: protectedProcedure
    .input(
      z.object({
        specialty: z.string().nullable().optional(),
        licenseNumber: z.string().nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const role = (ctx.user as any).role as string;

      if (role !== "doctor" && role !== "pharmacist") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Profile editing not available for this role" });
      }

      const values: Record<string, unknown> = {};
      if (input.specialty !== undefined) values.specialty = input.specialty;
      if (input.licenseNumber !== undefined) values.licenseNumber = input.licenseNumber;

      if (Object.keys(values).length === 0) return;

      const [updated] = await ctx.db
        .update(user)
        .set(values)
        .where(eq(user.id, ctx.user.id))
        .returning({
          id: user.id, name: user.name, role: user.role,
          specialty: user.specialty, licenseNumber: user.licenseNumber,
        });

      return updated;
    }),

  updateImage: protectedProcedure
    .input(z.object({ image: z.string().nullable() }))
    .mutation(async ({ ctx, input }) => {
      // Only allow null (remove) or valid MinIO avatar keys
      if (input.image !== null && !/^avatars\/[\w-]+\.(jpg|png|webp)$/.test(input.image)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid image value" });
      }
      const [updated] = await ctx.db
        .update(user)
        .set({ image: input.image })
        .where(eq(user.id, ctx.user.id))
        .returning({ id: user.id, image: user.image });
      return updated;
    }),

  // ── Professional links (patient ↔ doctor/pharmacist) ──────────────────────

  listLinkedUsers: protectedProcedure.query(async ({ ctx }) => {
    const role = (ctx.user as any).role as string;
    if (role === "patient") {
      const rows = await ctx.db.query.userLink.findMany({
        where: eq(userLink.patientId, ctx.user.id),
        with: { professional: { columns: { id: true, name: true, role: true, specialty: true } } },
      });
      return rows.map((r) => ({ ...r.professional, linkType: r.linkType }));
    }
    // doctor or pharmacist
    const rows = await ctx.db.query.userLink.findMany({
      where: eq(userLink.professionalId, ctx.user.id),
      with: { patient: { columns: { id: true, name: true, role: true } } },
    });
    return rows.map((r) => ({ ...r.patient, linkType: r.linkType }));
  }),

  addUserLink: protectedProcedure
    .input(z.object({
      targetUserId: z.string(),
      linkType: z.enum(["doctor", "wellness"]).optional().default("doctor"),
    }))
    .mutation(async ({ ctx, input }) => {
      const senderRole = (ctx.user as any).role as string;
      if (senderRole === "ia_agent" || senderRole === "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "This role cannot create links" });
      }
      await ctx.db
        .insert(connectionRequest)
        .values({ fromUserId: ctx.user.id, toUserId: input.targetUserId, type: "link", linkType: input.linkType })
        .onConflictDoNothing();
      return { ok: true };
    }),

  removeUserLink: protectedProcedure
    .input(z.object({
      targetUserId: z.string(),
      linkType: z.enum(["doctor", "wellness"]).optional().default("doctor"),
    }))
    .mutation(async ({ ctx, input }) => {
      const role = (ctx.user as any).role as string;
      const [patientId, professionalId] = role === "patient"
        ? [ctx.user.id, input.targetUserId]
        : [input.targetUserId, ctx.user.id];
      await ctx.db.delete(userLink).where(
        and(eq(userLink.patientId, patientId), eq(userLink.professionalId, professionalId), eq(userLink.linkType, input.linkType))
      );
      return { ok: true };
    }),

  // ── Friends (any role, directional) ───────────────────────────────────────

  listFriends: protectedProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db.query.userFriend.findMany({
      where: eq(userFriend.userId, ctx.user.id),
      with: { friend: { columns: { id: true, name: true, role: true, specialty: true } } },
    });
    return rows.map((r) => r.friend);
  }),

  addFriend: protectedProcedure
    .input(z.object({ friendId: z.string().min(1).max(100) }))
    .mutation(async ({ ctx, input }) => {
      const senderRole = (ctx.user as any).role as string;
      if (senderRole === "ia_agent" || senderRole === "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "This role cannot add friends" });
      }
      if (input.friendId === ctx.user.id) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot add yourself as a friend" });
      }
      await ctx.db
        .insert(connectionRequest)
        .values({ fromUserId: ctx.user.id, toUserId: input.friendId, type: "friend" })
        .onConflictDoNothing();
      return { ok: true };
    }),

  removeFriend: protectedProcedure
    .input(z.object({ friendId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.delete(userFriend).where(
        and(eq(userFriend.userId, ctx.user.id), eq(userFriend.friendId, input.friendId))
      );
      // Remove reverse direction too (mutual friendship)
      await ctx.db.delete(userFriend).where(
        and(eq(userFriend.userId, input.friendId), eq(userFriend.friendId, ctx.user.id))
      );
      return { ok: true };
    }),

  // ── Connection requests ───────────────────────────────────────────────────

  listPendingRequests: protectedProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db.query.connectionRequest.findMany({
      where: and(
        eq(connectionRequest.toUserId, ctx.user.id),
        eq(connectionRequest.status, "pending")
      ),
      with: { fromUser: { columns: { id: true, name: true, role: true, specialty: true } } },
      orderBy: [desc(connectionRequest.createdAt)],
      limit: 200,
    });
    return rows;
  }),

  listSentPendingRequests: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.query.connectionRequest.findMany({
      where: and(
        eq(connectionRequest.fromUserId, ctx.user.id),
        eq(connectionRequest.status, "pending")
      ),
      with: { toUser: { columns: { id: true, name: true, role: true } } },
      limit: 200,
    });
  }),

  respondToRequest: protectedProcedure
    .input(z.object({
      requestId: z.string().uuid(),
      response: z.enum(["accepted", "refused"]),
    }))
    .mutation(async ({ ctx, input }) => {
      const req = await ctx.db.query.connectionRequest.findFirst({
        where: and(
          eq(connectionRequest.id, input.requestId),
          eq(connectionRequest.toUserId, ctx.user.id),
          eq(connectionRequest.status, "pending")
        ),
        with: { fromUser: { columns: { id: true, role: true } } },
      });
      if (!req) throw new TRPCError({ code: "NOT_FOUND" });

      await ctx.db
        .update(connectionRequest)
        .set({ status: input.response, updatedAt: new Date() })
        .where(eq(connectionRequest.id, input.requestId));

      if (input.response === "accepted") {
        if (req.type === "link") {
          const fromRole = (req.fromUser as any).role as string;
          const [patientId, professionalId] = fromRole === "patient"
            ? [req.fromUserId, ctx.user.id]
            : [ctx.user.id, req.fromUserId];
          await ctx.db.insert(userLink).values({ patientId, professionalId, linkType: req.linkType ?? "doctor" }).onConflictDoNothing();
        } else {
          // type === "friend" — mutual
          await ctx.db.insert(userFriend)
            .values([
              { userId: req.fromUserId, friendId: ctx.user.id },
              { userId: ctx.user.id,    friendId: req.fromUserId },
            ])
            .onConflictDoNothing();
        }
      }
      return { ok: true };
    }),

  cancelRequest: protectedProcedure
    .input(z.object({
      targetUserId: z.string(),
      type: z.enum(["link", "friend"]),
      linkType: z.enum(["doctor", "wellness"]).optional().default("doctor"),
    }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.delete(connectionRequest).where(
        and(
          eq(connectionRequest.fromUserId, ctx.user.id),
          eq(connectionRequest.toUserId, input.targetUserId),
          eq(connectionRequest.type, input.type),
          eq(connectionRequest.linkType, input.linkType),
          eq(connectionRequest.status, "pending")
        )
      );
      return { ok: true };
    }),

  listProperties: protectedProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .select()
      .from(userProperty)
      .where(eq(userProperty.userId, ctx.user.id))
      .orderBy(userProperty.createdAt);
    return rows.map((r) =>
      ENCRYPTED_KEYS.has(r.key) ? { ...r, value: decrypt(r.value) } : r
    );
  }),

  setPropertiesLanguage: protectedProcedure
    .input(z.object({ language: z.enum(["en", "fr", "es", "zh", "ar", "hi"]) }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(user)
        .set({ propertiesLanguage: input.language })
        .where(eq(user.id, ctx.user.id));
      return { updated: true };
    }),

  setProperty: protectedProcedure
    .input(z.object({
      key: z.string().min(1).max(100),
      value: z.string().max(1000),
      language: z.string().min(2).max(10).default("en"),
    }))
    .mutation(async ({ ctx, input }) => {
      // Server-side validation for sensitive fields
      if (input.key === "ramq_number" && !/^[A-Z]{4}\s?\d{4}\s?\d{4}$/i.test(input.value)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid RAMQ number format" });
      }
      if (input.key === "ramq_expiry" && !/^\d{4}-\d{2}$/.test(input.value)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid RAMQ expiry format" });
      }

      await ctx.db
        .update(user)
        .set({ propertiesLanguage: input.language })
        .where(eq(user.id, ctx.user.id));

      const valueToStore = ENCRYPTED_KEYS.has(input.key) ? encrypt(input.value) : input.value;

      const [result] = await ctx.db
        .insert(userProperty)
        .values({ userId: ctx.user.id, key: input.key, value: valueToStore })
        .onConflictDoUpdate({
          target: [userProperty.userId, userProperty.key],
          set: { value: valueToStore, updatedAt: new Date() },
        })
        .returning({ id: userProperty.id, key: userProperty.key, value: userProperty.value });
      return result;
    }),

  deleteProperty: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .delete(userProperty)
        .where(and(eq(userProperty.id, input.id), eq(userProperty.userId, ctx.user.id)));
      return { deleted: true };
    }),
});
