import { requireUser } from "@/lib/auth";
import { deleteMovement } from "@/lib/store";
import { intParam, route } from "@/lib/api";

type Ctx = { params: Promise<{ id: string; mid: string }> };

export const DELETE = route(async (_req: Request, ctx: Ctx) => {
  const user = await requireUser();
  const p = await ctx.params;
  const state = deleteMovement(user.id, intParam(p.id), intParam(p.mid, "mid"));
  return Response.json({ state });
});
