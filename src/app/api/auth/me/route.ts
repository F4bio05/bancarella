import { getCurrentUser } from "@/lib/auth";
import { route } from "@/lib/api";

export const GET = route(async () => {
  const user = await getCurrentUser();
  return Response.json({ user });
});
