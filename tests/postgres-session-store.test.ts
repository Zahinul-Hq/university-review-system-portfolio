import type { SessionData } from "express-session";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  db: {
    delete: vi.fn(),
    select: vi.fn(),
    transaction: vi.fn(),
    update: vi.fn(),
  },
  transaction: {
    delete: vi.fn(),
    insert: vi.fn(),
  },
}));

vi.mock("../src/config.js", () => ({
  config: { session: { maxAge: 60_000 } },
}));
vi.mock("../src/db/index.js", () => ({ db: mocks.db }));

import { PostgresSessionStore } from "../src/api/postgres-session-store.js";

describe("PostgresSessionStore", () => {
  const selection = {
    from: vi.fn(),
    limit: vi.fn(),
    where: vi.fn(),
  };
  const deletion = { where: vi.fn() };
  const insertion = {
    onConflictDoUpdate: vi.fn(),
    values: vi.fn(),
  };
  const transactionDeletion = { where: vi.fn() };
  const update = {
    set: vi.fn(),
    where: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    selection.from.mockReturnValue(selection);
    selection.where.mockReturnValue(selection);
    mocks.db.select.mockReturnValue(selection);
    mocks.db.delete.mockReturnValue(deletion);
    deletion.where.mockResolvedValue([]);
    insertion.values.mockReturnValue(insertion);
    insertion.onConflictDoUpdate.mockResolvedValue(undefined);
    transactionDeletion.where.mockResolvedValue([]);
    mocks.transaction.insert.mockReturnValue(insertion);
    mocks.transaction.delete.mockReturnValue(transactionDeletion);
    mocks.db.transaction.mockImplementation((operation) =>
      operation(mocks.transaction),
    );
    update.set.mockReturnValue(update);
    update.where.mockResolvedValue([]);
    mocks.db.update.mockReturnValue(update);
  });

  it("loads an unexpired session from the database", async () => {
    const sessionData = { cookie: { maxAge: 60_000 } } as SessionData;
    selection.limit.mockResolvedValue([
      { sessionData, expiresAt: new Date(Date.now() + 60_000) },
    ]);

    const result = await getSession(new PostgresSessionStore(), "session-1");

    expect(result).toEqual({ error: null, sessionData });
    expect(mocks.db.delete).not.toHaveBeenCalled();
  });

  it("removes expired sessions before returning them as missing", async () => {
    selection.limit.mockResolvedValue([
      { sessionData: { cookie: {} }, expiresAt: new Date(Date.now() - 1) },
    ]);

    const result = await getSession(new PostgresSessionStore(), "session-1");

    expect(result).toEqual({ error: null, sessionData: null });
    expect(mocks.db.delete).toHaveBeenCalledTimes(1);
    expect(deletion.where).toHaveBeenCalledTimes(1);
  });

  it("persists sessions with their cookie expiry and prunes expired rows", async () => {
    const expires = new Date(Date.now() + 60_000);
    const sessionData = { cookie: { expires } } as SessionData;
    const store = new PostgresSessionStore();

    await new Promise<void>((resolve, reject) => {
      store.set("session-1", sessionData, (error) =>
        error ? reject(error) : resolve(),
      );
    });

    expect(insertion.values).toHaveBeenCalledWith({
      sessionId: "session-1",
      sessionData,
      expiresAt: expires,
    });
    expect(insertion.onConflictDoUpdate).toHaveBeenCalledTimes(1);
    expect(transactionDeletion.where).toHaveBeenCalledTimes(1);
  });

  it("touches and destroys sessions through the database", async () => {
    const sessionData = {
      cookie: { expires: new Date(Date.now() + 60_000) },
    } as SessionData;
    const store = new PostgresSessionStore();

    await new Promise<void>((resolve, reject) => {
      store.touch("session-1", sessionData, (error) =>
        error ? reject(error) : resolve(),
      );
    });
    expect(update.set).toHaveBeenCalledWith({
      expiresAt: sessionData.cookie.expires,
    });

    await new Promise<void>((resolve, reject) => {
      store.destroy("session-1", (error) =>
        error ? reject(error) : resolve(),
      );
    });
    expect(mocks.db.delete).toHaveBeenCalledTimes(1);
  });
});

function getSession(store: PostgresSessionStore, sessionId: string) {
  return new Promise<{
    error: unknown;
    sessionData?: SessionData | null;
  }>((resolve) => {
    store.get(sessionId, (error, sessionData) => resolve({ error, sessionData }));
  });
}
