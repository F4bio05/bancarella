import { requireUser } from "@/lib/auth";
import { reopenDay } from "@/lib/store";
import { intParam, route } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

export const POST = route(async (_req: Request, ctx: Ctx) => {
  const user = await requireUser();
  const state = reopenDay(user.id, intParam((await ctx.params).id));
  return Response.json({ state });
});
