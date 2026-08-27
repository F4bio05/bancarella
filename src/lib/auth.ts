import crypto from "node:crypto";
import { cookies } from "next/headers";
import { getDb, nowIso } from "./db";

export const SESSION_COOKIE = "bancarella_session";
const SESSION_DAYS = 120;

/**
 * In produzione il cookie di sessione viaggia solo su HTTPS. Se il server è
 * raggiungibile in semplice HTTP (rete locale, IP nudo, prova interna) il
 * browser scarterebbe il cookie e l'accesso non funzionerebbe affatto: in quel
 * caso si imposta COOKIE_NON_SICURO=1 nell'ambiente.
 */
const COOKIE_SICURO =
  process.env.COOKIE_NON_SICURO === "1" ? false : process.env.NODE_ENV === "production";

export type User = { id: number; email: string; name: string };

/* ------------------------------ password ------------------------------ */

const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 };

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16);
  const key = crypto.scryptSync(password, salt, SCRYPT.keylen, {
    N: SCRYPT.N,
    r: SCRYPT.r,
    p: SCRYPT.p,
  });
  return `scrypt$${SCRYPT.N}$${salt.toString("hex")}$${key.toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, nRaw, saltHex, keyHex] = stored.split("$");
  if (scheme !== "scrypt" || !saltHex || !keyHex) return false;
  const expected = Buffer.from(keyHex, "hex");
  const actual = crypto.scryptSync(password, Buffer.from(saltHex, "hex"), expected.length, {
    N: Number(nRaw),
    r: SCRYPT.r,
    p: SCRYPT.p,
  });
  return crypto.timingSafeEqual(expected, actual);
}

/* ------------------------------ sessioni ------------------------------ */

export function createSession(userId: number): { token: string; expiresAt: Date } {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 864e5);
  getDb()
    .prepare("INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)")
    .run(token, userId, nowIso(), expiresAt.toISOString());
  return { token, expiresAt };
}

export function destroySession(token: string): void {
  getDb().prepare("DELETE FROM sessions WHERE token = ?").run(token);
}

export async function setSessionCookie(token: string, expiresAt: Date): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: COOKIE_SICURO,
    path: "/",
    expires: expiresAt,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

/** Utente della richiesta corrente, oppure null. */
export async function getCurrentUser(): Promise<User | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const row = getDb()
    .prepare(
      `SELECT u.id AS id, u.email AS email, u.name AS name, s.expires_at AS expires_at
         FROM sessions s JOIN users u ON u.id = s.user_id
        WHERE s.token = ?`,
    )
    .get(token) as { id: number; email: string; name: string; expires_at: string } | undefined;

  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) {
    destroySession(token);
    return null;
  }
  return { id: row.id, email: row.email, name: row.name };
}

/** Come getCurrentUser, ma lancia una Response 401 se non autenticato. */
export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) {
    throw Response.json({ error: "Non autenticato" }, { status: 401 });
  }
  return user;
}
