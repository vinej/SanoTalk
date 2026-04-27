import { vi } from "vitest";

/**
 * Creates a mock Drizzle DB object for unit tests.
 * All query/mutation methods are vi.fn() stubs — configure them per test with
 * mockResolvedValue / mockResolvedValueOnce.
 */
export function createMockDb() {
  // Chainable stub used by insert/update/delete/select builders.
  // The chain is itself thenable and resolves to [] so that `await db.select().from(x).where(y)`
  // (no .returning()) works the same as `await db....returning()`. Tests can override with
  // `db._chain.thenValue = [...]` or by reconfiguring `_chain.returning`.
  const chain: {
    set: ReturnType<typeof vi.fn>;
    values: ReturnType<typeof vi.fn>;
    where: ReturnType<typeof vi.fn>;
    from: ReturnType<typeof vi.fn>;
    orderBy: ReturnType<typeof vi.fn>;
    limit: ReturnType<typeof vi.fn>;
    onConflictDoNothing: ReturnType<typeof vi.fn>;
    onConflictDoUpdate: ReturnType<typeof vi.fn>;
    returning: ReturnType<typeof vi.fn>;
    then: (onFulfilled: (v: unknown[]) => unknown, onRejected?: (e: unknown) => unknown) => Promise<unknown>;
    thenValue: unknown[];
  } = {
    set: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    onConflictDoNothing: vi.fn().mockReturnThis(),
    onConflictDoUpdate: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([]),
    then: (onFulfilled, onRejected) =>
      Promise.resolve(chain.thenValue).then(onFulfilled, onRejected),
    thenValue: [],
  };

  const db = {
    query: {
      talkSession: {
        findFirst: vi.fn().mockResolvedValue(undefined),
        findMany: vi.fn().mockResolvedValue([]),
      },
      user: {
        findFirst: vi.fn().mockResolvedValue(undefined),
        findMany: vi.fn().mockResolvedValue([]),
      },
    },
    select: vi.fn().mockReturnValue(chain),
    insert: vi.fn().mockReturnValue(chain),
    update: vi.fn().mockReturnValue(chain),
    delete: vi.fn().mockReturnValue(chain),
    // Expose chain so tests can reconfigure returning() results
    _chain: chain,
  };

  return db;
}

export type MockDb = ReturnType<typeof createMockDb>;
