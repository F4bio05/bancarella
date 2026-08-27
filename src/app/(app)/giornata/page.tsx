import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getDayState, getOpenDay, listPeople } from "@/lib/store";
import { GiornataClient } from "@/components/GiornataClient";

export const metadata = { title: "Giornata — Bancarella" };
export const dynamic = "force-dynamic";

export default async function GiornataPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const aperta = getOpenDay(user.id);
  const stato = aperta ? getDayState(user.id, aperta.id) : null;
  const persone = listPeople(user.id);

  return <GiornataClient userId={user.id} iniziale={stato} personeIniziali={persone} />;
}
