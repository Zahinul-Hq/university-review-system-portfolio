import { eq, lte } from "drizzle-orm";
import session from "express-session";
import type { SessionData } from "express-session";

import { config } from "../config.js";
import { db } from "../db/index.js";
import { webSessions } from "../db/schema.js";

type StoreCallback = (error?: unknown) => void;

export class PostgresSessionStore extends session.Store {
  get(
    sessionId: string,
    callback: (error: unknown, sessionData?: SessionData | null) => void,
  ) {
    void db
      .select({
        sessionData: webSessions.sessionData,
        expiresAt: webSessions.expiresAt,
      })
      .from(webSessions)
      .where(eq(webSessions.sessionId, sessionId))
      .limit(1)
      .then(async ([storedSession]) => {
        if (!storedSession) {
          callback(null, null);
          return;
        }

        if (storedSession.expiresAt <= new Date()) {
          await db
            .delete(webSessions)
            .where(eq(webSessions.sessionId, sessionId));
          callback(null, null);
          return;
        }

        callback(null, storedSession.sessionData);
      })
      .catch(callback);
  }

  set(
    sessionId: string,
    sessionData: SessionData,
    callback?: StoreCallback,
  ) {
    void db
      .transaction(async (tx) => {
        await tx
          .insert(webSessions)
          .values({
            sessionId,
            sessionData,
            expiresAt: getSessionExpiry(sessionData),
          })
          .onConflictDoUpdate({
            target: webSessions.sessionId,
            set: {
              sessionData,
              expiresAt: getSessionExpiry(sessionData),
            },
          });

        await tx
          .delete(webSessions)
          .where(lte(webSessions.expiresAt, new Date()));
      })
      .then(() => callback?.())
      .catch((error: unknown) => reportStoreError(callback, error));
  }

  destroy(sessionId: string, callback?: StoreCallback) {
    void db
      .delete(webSessions)
      .where(eq(webSessions.sessionId, sessionId))
      .then(() => callback?.())
      .catch((error: unknown) => reportStoreError(callback, error));
  }

  touch(
    sessionId: string,
    sessionData: SessionData,
    callback?: StoreCallback,
  ) {
    void db
      .update(webSessions)
      .set({ expiresAt: getSessionExpiry(sessionData) })
      .where(eq(webSessions.sessionId, sessionId))
      .then(() => callback?.())
      .catch((error: unknown) => reportStoreError(callback, error));
  }
}

function getSessionExpiry(sessionData: SessionData): Date {
  if (sessionData.cookie.expires instanceof Date) {
    return sessionData.cookie.expires;
  }

  const maxAge = sessionData.cookie.maxAge ?? config.session.maxAge;
  return new Date(Date.now() + maxAge);
}

function reportStoreError(
  callback: StoreCallback | undefined,
  error: unknown,
): void {
  if (callback) {
    callback(error);
    return;
  }

  console.error("PostgreSQL session store operation failed", error);
}
