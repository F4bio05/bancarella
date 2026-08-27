import { requireUser } from "@/lib/auth";
import { deletePerson, updatePerson } from "@/lib/store";
import { intParam, readJson, route } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };
type Body = { name?: string; phone?: string | null; note?: string | null; archived?: boolean };

export const PATCH = route(async (req: Request, ctx: Ctx) => {
  const user = await requireUser();
  const id = intParam((await ctx.params).id);
  const person = updatePerson(user.id, id, await readJson<Body>(req));
  return Response.json({ person });
});

export const DELETE = route(async (_req: Request, ctx: Ctx) => {
  const user = await requireUser();
  const id = intParam((await ctx.params).id);
  deletePerson(user.id, id);
  return Response.json({ ok: true });
});
