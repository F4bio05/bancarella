import { cookies } from "next/headers";
import { SESSION_COOKIE, clearSessionCookie, destroySession } from "@/lib/auth";
import { route } from "@/lib/api";

export const POST = route(async () => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (token) destroySession(token);
  await clearSessionCookie();
  return Response.json({ ok: true });
});
