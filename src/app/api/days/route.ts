import { requireUser } from "@/lib/auth";
import { listDays, openDay } from "@/lib/store";
import { readJson, route } from "@/lib/api";

export const GET = route(async () => {
  const user = await requireUser();
  return Response.json({ days: listDays(user.id) });
});

type Body = { date?: string; label?: string | null; personIds?: number[] };

export const POST = route(async (req: Request) => {
  const user = await requireUser();
  const body = await readJson<Body>(req);
  const state = openDay(user.id, {
    date: body.date ?? "",
    label: body.label,
    personIds: (body.personIds ?? []).filter((n) => Number.isInteger(n) && n > 0),
  });
  return Response.json({ state }, { status: 201 });
});
