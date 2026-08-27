import { requireUser } from "@/lib/auth";
import { createPerson, listPeople } from "@/lib/store";
import { readJson, route } from "@/lib/api";

export const GET = route(async (req: Request) => {
  const user = await requireUser();
  const includeArchived = new URL(req.url).searchParams.get("archiviate") === "1";
  return Response.json({ people: listPeople(user.id, includeArchived) });
});

type Body = { name?: string; phone?: string | null; note?: string | null };

export const POST = route(async (req: Request) => {
  const user = await requireUser();
  const body = await readJson<Body>(req);
  const person = createPerson(user.id, body.name ?? "", body.phone, body.note);
  return Response.json({ person }, { status: 201 });
});
