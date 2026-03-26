import { describe, it, expect, beforeEach } from "vitest";
import { TRPCError } from "@trpc/server";
import { createMockDb } from "./helpers/mock-db";
import { createAuthedCaller, createUnauthCaller, mockUser } from "./helpers/create-caller";

// ── Shared fixture ────────────────────────────────────────────────────────────

const SESSION_ID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const OTHER_USER_ID = "ffffffff-0000-1111-2222-333333333333";

function makeSession(overrides: Record<string, unknown> = {}) {
  return {
    id: SESSION_ID,
    roomName: "sanotalk-abcde12345",
    hostId: mockUser.id,
    title: "Test Session",
    language: "en",
    status: "scheduled",
    scheduledAt: null,
    startedAt: null,
    endedAt: null,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    participants: [],
    ...overrides,
  };
}

// ── sessions.create ───────────────────────────────────────────────────────────

describe("sessions.create", () => {
  it("creates a session and returns it", async () => {
    const db = createMockDb();
    const created = makeSession();
    db._chain.returning.mockResolvedValue([created]);

    const caller = createAuthedCaller(db);
    const result = await caller.sessions.create({ title: "Test Session", language: "en" });

    expect(db.insert).toHaveBeenCalled();
    expect(result).toMatchObject({ title: "Test Session", hostId: mockUser.id });
  });

  it("creates a session without a title", async () => {
    const db = createMockDb();
    const created = makeSession({ title: null, language: "fr" });
    db._chain.returning.mockResolvedValue([created]);

    const caller = createAuthedCaller(db);
    const result = await caller.sessions.create({ language: "fr" });

    expect(result.language).toBe("fr");
  });

  it("sets roomName with sanotalk- prefix", async () => {
    const db = createMockDb();
    db._chain.returning.mockResolvedValue([makeSession()]);

    const caller = createAuthedCaller(db);
    // Verify insert was called with a roomName starting with 'sanotalk-'
    await caller.sessions.create({});
    const insertCall = db._chain.values.mock.calls[0]?.[0] as { roomName?: string } | undefined;
    expect(insertCall?.roomName).toMatch(/^sanotalk-/);
  });

  it("throws UNAUTHORIZED when not authenticated", async () => {
    const db = createMockDb();
    const caller = createUnauthCaller(db);
    await expect(caller.sessions.create({})).rejects.toThrow(
      expect.objectContaining({ code: "UNAUTHORIZED" })
    );
  });
});

// ── sessions.list ─────────────────────────────────────────────────────────────

describe("sessions.list", () => {
  it("returns sessions for the authenticated user", async () => {
    const db = createMockDb();
    const sessions = [makeSession(), makeSession({ id: "bbbbbbbb-cccc-dddd-eeee-ffffffffffff" })];
    db.query.talkSession.findMany.mockResolvedValue(sessions);

    const caller = createAuthedCaller(db);
    const result = await caller.sessions.list();

    expect(result).toHaveLength(2);
    expect(db.query.talkSession.findMany).toHaveBeenCalledOnce();
  });

  it("returns an empty array when user has no sessions", async () => {
    const db = createMockDb();
    db.query.talkSession.findMany.mockResolvedValue([]);

    const caller = createAuthedCaller(db);
    const result = await caller.sessions.list();

    expect(result).toEqual([]);
  });

  it("throws UNAUTHORIZED when not authenticated", async () => {
    const db = createMockDb();
    const caller = createUnauthCaller(db);
    await expect(caller.sessions.list()).rejects.toThrow(
      expect.objectContaining({ code: "UNAUTHORIZED" })
    );
  });
});

// ── sessions.byId ─────────────────────────────────────────────────────────────

describe("sessions.byId", () => {
  it("returns session when user is the host", async () => {
    const db = createMockDb();
    db.query.talkSession.findFirst.mockResolvedValue(makeSession());

    const caller = createAuthedCaller(db);
    const result = await caller.sessions.byId({ id: SESSION_ID });

    expect(result.id).toBe(SESSION_ID);
  });

  it("returns session when user is a participant", async () => {
    const db = createMockDb();
    db.query.talkSession.findFirst.mockResolvedValue(
      makeSession({
        hostId: OTHER_USER_ID,
        participants: [{ userId: mockUser.id, user: mockUser }],
      })
    );

    const caller = createAuthedCaller(db);
    const result = await caller.sessions.byId({ id: SESSION_ID });

    expect(result.id).toBe(SESSION_ID);
  });

  it("throws NOT_FOUND when session does not exist", async () => {
    const db = createMockDb();
    db.query.talkSession.findFirst.mockResolvedValue(undefined);

    const caller = createAuthedCaller(db);
    await expect(caller.sessions.byId({ id: SESSION_ID })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("throws FORBIDDEN when user has no access", async () => {
    const db = createMockDb();
    db.query.talkSession.findFirst.mockResolvedValue(
      makeSession({ hostId: OTHER_USER_ID, participants: [] })
    );

    const caller = createAuthedCaller(db);
    await expect(caller.sessions.byId({ id: SESSION_ID })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("throws UNAUTHORIZED when not authenticated", async () => {
    const db = createMockDb();
    const caller = createUnauthCaller(db);
    await expect(caller.sessions.byId({ id: SESSION_ID })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });
});

// ── sessions.rename ───────────────────────────────────────────────────────────

describe("sessions.rename", () => {
  it("renames session when user is the host", async () => {
    const db = createMockDb();
    const renamed = makeSession({ title: "New Title" });
    db.query.talkSession.findFirst.mockResolvedValue(makeSession());
    db._chain.returning.mockResolvedValue([renamed]);

    const caller = createAuthedCaller(db);
    const result = await caller.sessions.rename({ id: SESSION_ID, title: "New Title" });

    expect(result.title).toBe("New Title");
    expect(db.update).toHaveBeenCalled();
  });

  it("throws NOT_FOUND when session does not exist", async () => {
    const db = createMockDb();
    db.query.talkSession.findFirst.mockResolvedValue(undefined);

    const caller = createAuthedCaller(db);
    await expect(
      caller.sessions.rename({ id: SESSION_ID, title: "New Title" })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("throws FORBIDDEN when user is not the host", async () => {
    const db = createMockDb();
    db.query.talkSession.findFirst.mockResolvedValue(makeSession({ hostId: OTHER_USER_ID }));

    const caller = createAuthedCaller(db);
    await expect(
      caller.sessions.rename({ id: SESSION_ID, title: "New Title" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

// ── sessions.start ────────────────────────────────────────────────────────────

describe("sessions.start", () => {
  it("sets status to active when user is the host", async () => {
    const db = createMockDb();
    const started = makeSession({ status: "active", startedAt: new Date() });
    db.query.talkSession.findFirst.mockResolvedValue(makeSession());
    db._chain.returning.mockResolvedValue([started]);

    const caller = createAuthedCaller(db);
    const result = await caller.sessions.start({ id: SESSION_ID });

    expect(result.status).toBe("active");
    expect(result.startedAt).toBeDefined();
  });

  it("throws NOT_FOUND when session does not exist", async () => {
    const db = createMockDb();
    db.query.talkSession.findFirst.mockResolvedValue(undefined);

    const caller = createAuthedCaller(db);
    await expect(caller.sessions.start({ id: SESSION_ID })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("throws FORBIDDEN when user is not the host", async () => {
    const db = createMockDb();
    db.query.talkSession.findFirst.mockResolvedValue(makeSession({ hostId: OTHER_USER_ID }));

    const caller = createAuthedCaller(db);
    await expect(caller.sessions.start({ id: SESSION_ID })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});

// ── sessions.end ──────────────────────────────────────────────────────────────

describe("sessions.end", () => {
  it("sets status to completed when user is the host", async () => {
    const db = createMockDb();
    const ended = makeSession({ status: "completed", endedAt: new Date() });
    db.query.talkSession.findFirst.mockResolvedValue(makeSession({ status: "active" }));
    db._chain.returning.mockResolvedValue([ended]);

    const caller = createAuthedCaller(db);
    const result = await caller.sessions.end({ id: SESSION_ID });

    expect(result.status).toBe("completed");
    expect(result.endedAt).toBeDefined();
  });

  it("throws NOT_FOUND when session does not exist", async () => {
    const db = createMockDb();
    db.query.talkSession.findFirst.mockResolvedValue(undefined);

    const caller = createAuthedCaller(db);
    await expect(caller.sessions.end({ id: SESSION_ID })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("throws FORBIDDEN when user is not the host", async () => {
    const db = createMockDb();
    db.query.talkSession.findFirst.mockResolvedValue(makeSession({ hostId: OTHER_USER_ID }));

    const caller = createAuthedCaller(db);
    await expect(caller.sessions.end({ id: SESSION_ID })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});

// ── sessions.delete ───────────────────────────────────────────────────────────

describe("sessions.delete", () => {
  it("deletes session when user is the host", async () => {
    const db = createMockDb();
    db.query.talkSession.findFirst.mockResolvedValue(makeSession());

    const caller = createAuthedCaller(db);
    await caller.sessions.delete({ id: SESSION_ID });

    expect(db.delete).toHaveBeenCalled();
  });

  it("throws NOT_FOUND when session does not exist", async () => {
    const db = createMockDb();
    db.query.talkSession.findFirst.mockResolvedValue(undefined);

    const caller = createAuthedCaller(db);
    await expect(caller.sessions.delete({ id: SESSION_ID })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("throws FORBIDDEN when user is not the host", async () => {
    const db = createMockDb();
    db.query.talkSession.findFirst.mockResolvedValue(makeSession({ hostId: OTHER_USER_ID }));

    const caller = createAuthedCaller(db);
    await expect(caller.sessions.delete({ id: SESSION_ID })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("throws UNAUTHORIZED when not authenticated", async () => {
    const db = createMockDb();
    const caller = createUnauthCaller(db);
    await expect(caller.sessions.delete({ id: SESSION_ID })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });
});
