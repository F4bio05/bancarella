import { requireUser } from "@/lib/auth";
import { addParticipants, createAndAddPerson, removeParticipant } from "@/lib/store";
import { intParam, readJson, route } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };
type Body = { personIds?: number[]; name?: string };

export const POST = route(async (req: Request, ctx: Ctx) => {
  const user = await requireUser();
  const dayId = intParam((await ctx.params).id);
  const body = await readJson<Body>(req);

  if (body.name && body.name.trim()) {
    return Response.json({ state: createAndAddPerson(user.id, dayId, body.name) });
  }
  const ids = (body.personIds ?? []).filter((n) => Number.isInteger(n) && n > 0);
  if (ids.length === 0) {
    return Response.json({ error: "Nessuna persona selezionata" }, { status: 400 });
  }
  return Response.json({ state: addParticipants(user.id, dayId, ids) });
});

export const DELETE = route(async (req: Request, ctx: Ctx) => {
  const user = await requireUser();
  const dayId = intParam((await ctx.params).id);
  const personId = intParam(new URL(req.url).searchParams.get("personId") ?? "", "personId");
  return Response.json({ state: removeParticipant(user.id, dayId, personId) });
});
