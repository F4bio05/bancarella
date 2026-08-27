import { requireUser } from "@/lib/auth";
import { getDayState, getOpenDay } from "@/lib/store";
import { route } from "@/lib/api";

export const GET = route(async () => {
  const user = await requireUser();
  const open = getOpenDay(user.id);
  return Response.json({ state: open ? getDayState(user.id, open.id) : null });
});
