import { getDb, nowIso } from "@/lib/db";
import { createSession, hashPassword, setSessionCookie } from "@/lib/auth";
import { readJson, route } from "@/lib/api";

type Body = { name?: string; email?: string; password?: string };

export const POST = route(async (req: Request) => {
  const body = await readJson<Body>(req);
  const name = (body.name ?? "").trim().replace(/\s+/g, " ");
  const email = (body.email ?? "").trim();
  const password = body.password ?? "";

  if (name.length < 2) {
    return Response.json({ error: "Inserisci il tuo nome" }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return Response.json({ error: "Email non valida" }, { status: 400 });
  }
  if (password.length < 6) {
    return Response.json({ error: "La password deve avere almeno 6 caratteri" }, { status: 400 });
  }

  const exists = getDb()
    .prepare("SELECT id FROM users WHERE email_lower = ?")
    .get(email.toLowerCase());
  if (exists) {
    return Response.json({ error: "Esiste già un account con questa email" }, { status: 409 });
  }

  const info = getDb()
    .prepare(
      `INSERT INTO users (email, email_lower, name, password_hash, created_at)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(email, email.toLowerCase(), name, hashPassword(password), nowIso());

  const userId = Number(info.lastInsertRowid);
  const { token, expiresAt } = createSession(userId);
  await setSessionCookie(token, expiresAt);

  return Response.json({ user: { id: userId, email, name } }, { status: 201 });
});
