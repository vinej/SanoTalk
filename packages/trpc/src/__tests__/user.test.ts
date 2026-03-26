import { describe, it, expect } from "vitest";
import { createMockDb } from "./helpers/mock-db";
import { createAuthedCaller, createUnauthCaller, mockUser } from "./helpers/create-caller";

const OTHER_ID = "cccccccc-dddd-eeee-ffff-000000000000";

function makeUserRecord(overrides: Record<string, unknown> = {}) {
  return {
    ...mockUser,
    linkedDoctor: null,
    linkedPharmacist: null,
    ...overrides,
  };
}

// ── user.profile ──────────────────────────────────────────────────────────────

describe("user.profile", () => {
  it("returns the authenticated user's profile with linked providers", async () => {
    const db = createMockDb();
    const profile = makeUserRecord({ linkedDoctor: { id: OTHER_ID, name: "Dr. Smith" } });
    db.query.user.findFirst.mockResolvedValue(profile);

    const caller = createAuthedCaller(db);
    const result = await caller.user.profile();

    expect(result).toMatchObject({ id: mockUser.id });
    expect(db.query.user.findFirst).toHaveBeenCalledOnce();
  });

  it("returns undefined when user record is not found", async () => {
    const db = createMockDb();
    db.query.user.findFirst.mockResolvedValue(undefined);

    const caller = createAuthedCaller(db);
    const result = await caller.user.profile();

    expect(result).toBeUndefined();
  });

  it("throws UNAUTHORIZED when not authenticated", async () => {
    const db = createMockDb();
    const caller = createUnauthCaller(db);
    await expect(caller.user.profile()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});

// ── user.listByRole ───────────────────────────────────────────────────────────

describe("user.listByRole", () => {
  it("returns doctors when role is doctor", async () => {
    const db = createMockDb();
    const doctors = [
      { id: OTHER_ID, name: "Dr. Smith", email: "smith@example.com", specialty: "Cardiology", licenseNumber: "123" },
    ];
    db.query.user.findMany.mockResolvedValue(doctors);

    const caller = createAuthedCaller(db);
    const result = await caller.user.listByRole({ role: "doctor" });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ name: "Dr. Smith" });
  });

  it("returns pharmacists when role is pharmacist", async () => {
    const db = createMockDb();
    db.query.user.findMany.mockResolvedValue([]);

    const caller = createAuthedCaller(db);
    const result = await caller.user.listByRole({ role: "pharmacist" });

    expect(result).toEqual([]);
    expect(db.query.user.findMany).toHaveBeenCalledOnce();
  });

  it("throws UNAUTHORIZED when not authenticated", async () => {
    const db = createMockDb();
    const caller = createUnauthCaller(db);
    await expect(caller.user.listByRole({ role: "doctor" })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });
});

// ── user.update ───────────────────────────────────────────────────────────────

describe("user.update", () => {
  it("allows a patient to link a doctor", async () => {
    const db = createMockDb();
    const updatedUser = makeUserRecord({ role: "patient", linkedDoctorId: OTHER_ID });
    db._chain.returning.mockResolvedValue([updatedUser]);

    const patientCaller = createAuthedCaller(db, { role: "patient" });
    const result = await patientCaller.user.update({ linkedDoctorId: OTHER_ID });

    expect(db.update).toHaveBeenCalled();
    expect(result).toMatchObject({ linkedDoctorId: OTHER_ID });
  });

  it("allows a doctor to update specialty and license", async () => {
    const db = createMockDb();
    const updatedUser = makeUserRecord({ specialty: "Cardiology", licenseNumber: "DOC-123" });
    db._chain.returning.mockResolvedValue([updatedUser]);

    const caller = createAuthedCaller(db);
    const result = await caller.user.update({ specialty: "Cardiology", licenseNumber: "DOC-123" });

    expect(db.update).toHaveBeenCalled();
    expect(result).toMatchObject({ specialty: "Cardiology", licenseNumber: "DOC-123" });
  });

  it("returns undefined when no fields are provided", async () => {
    const db = createMockDb();

    const caller = createAuthedCaller(db);
    const result = await caller.user.update({});

    // No DB update should happen when nothing changed
    expect(db.update).not.toHaveBeenCalled();
    expect(result).toBeUndefined();
  });

  it("throws UNAUTHORIZED when not authenticated", async () => {
    const db = createMockDb();
    const caller = createUnauthCaller(db);
    await expect(caller.user.update({ specialty: "X" })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });
});
