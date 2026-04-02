import { vi } from "vitest";
import { createCallerFactory } from "../../trcp";
import { appRouter } from "../../router";
import type { TRPCContext } from "../../context";
import type { MockDb } from "./mock-db";

const callerFactory = createCallerFactory(appRouter);

// ── Fixture: authenticated user ──────────────────────────────────────────────

export const mockUser = {
  id: "550e8400-e29b-41d4-a716-446655440000",
  name: "Test User",
  email: "test@example.com",
  role: "doctor",
  emailVerified: true,
  image: null,
  twoFactorEnabled: null,
  specialty: null,
  licenseNumber: null,
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
};

export const mockAuthSession = {
  session: {
    id: "auth-session-id",
    userId: mockUser.id,
    token: "test-token",
    expiresAt: new Date(Date.now() + 86_400_000),
    createdAt: new Date(),
    updatedAt: new Date(),
    ipAddress: null,
    userAgent: null,
  },
  user: mockUser,
};

// ── Context factories ────────────────────────────────────────────────────────

function baseCtx(db: MockDb): TRPCContext {
  return {
    db: db as unknown as TRPCContext["db"],
    req: {} as TRPCContext["req"],
    res: {} as TRPCContext["res"],
    session: null,
    user: null,
    triggerAgentRun: vi.fn(),
    callHealthChat: vi.fn().mockResolvedValue(""),
  };
}

/** Caller with a valid authenticated user in context. */
export function createAuthedCaller(db: MockDb, userOverrides: Partial<typeof mockUser> = {}) {
  const user = { ...mockUser, ...userOverrides };
  return callerFactory({
    ...baseCtx(db),
    session: { ...mockAuthSession, user },
    user,
  });
}

/** Caller with no session — for testing the UNAUTHORIZED guard. */
export function createUnauthCaller(db: MockDb) {
  return callerFactory(baseCtx(db));
}
