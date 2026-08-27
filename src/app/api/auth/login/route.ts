import { getDb } from "@/lib/db";
import { createSession, setSessionCookie, verifyPassword } from "@/lib/auth";
import { readJson, route } from "@/lib/api";

type Body = { email?: string; password?: string };
type Row = { id: number; email: string; name: string; password_hash: string };

export const POST = route(async (req: Request) => {
  const body = await readJson<Body>(req);
  const email = (body.email ?? "").trim().toLowerCase();
  const password = body.password ?? "";

  const row = getDb()
    .prepare("SELECT id, email, name, password_hash FROM users WHERE email_lower = ?")
    .get(email) as Row | undefined;

  if (!row || !verifyPassword(password, row.password_hash)) {
    return Response.json({ error: "Email o password non corretti" }, { status: 401 });
  }

  const { token, expiresAt } = createSession(row.id);
  await setSessionCookie(token, expiresAt);
  return Response.json({ user: { id: row.id, email: row.email, name: row.name } });
});
