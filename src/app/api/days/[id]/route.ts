import { requireUser } from "@/lib/auth";
import { deleteDay, getDayState, updateDay } from "@/lib/store";
import { intParam, readJson, route } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route(async (_req: Request, ctx: Ctx) => {
  const user = await requireUser();
  const id = intParam((await ctx.params).id);
  return Response.json({ state: getDayState(user.id, id) });
});

export const PATCH = route(async (req: Request, ctx: Ctx) => {
  const user = await requireUser();
  const id = intParam((await ctx.params).id);
  const body = await readJson<{ label?: string | null; date?: string }>(req);
  return Response.json({ state: updateDay(user.id, id, body) });
});

export const DELETE = route(async (_req: Request, ctx: Ctx) => {
  const user = await requireUser();
  const id = intParam((await ctx.params).id);
  deleteDay(user.id, id);
  return Response.json({ ok: true });
});
