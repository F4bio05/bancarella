import { requireUser } from "@/lib/auth";
import { addMovement } from "@/lib/store";
import { intParam, readJson, route } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };
type Body = { personId?: number; amountCents?: number; note?: string | null; clientId?: string };

export const POST = route(async (req: Request, ctx: Ctx) => {
  const user = await requireUser();
  const dayId = intParam((await ctx.params).id);
  const body = await readJson<Body>(req);
  if (!Number.isInteger(body.personId) || (body.personId ?? 0) <= 0) {
    return Response.json({ error: "personId non valido" }, { status: 400 });
  }
  const state = addMovement(user.id, dayId, {
    personId: body.personId as number,
    amountCents: Number(body.amountCents),
    note: body.note,
    clientId: body.clientId,
  });
  return Response.json({ state }, { status: 201 });
});
