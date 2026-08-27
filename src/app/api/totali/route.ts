import { requireUser } from "@/lib/auth";
import { totaliPerPersona } from "@/lib/store";
import { route } from "@/lib/api";

export const GET = route(async () => {
  const user = await requireUser();
  return Response.json({ totali: totaliPerPersona(user.id) });
});
