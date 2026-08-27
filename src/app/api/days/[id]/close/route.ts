import { requireUser } from "@/lib/auth";
import { closeDay } from "@/lib/store";
import { intParam, route } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

export const POST = route(async (_req: Request, ctx: Ctx) => {
  const user = await requireUser();
  const state = closeDay(user.id, intParam((await ctx.params).id));
  return Response.json({ state });
});
