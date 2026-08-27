import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { listPeople, totaliPerPersona } from "@/lib/store";
import { PersoneClient } from "@/components/PersoneClient";

export const metadata = { title: "Persone — Bancarella" };
export const dynamic = "force-dynamic";

export default async function PersonePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const persone = listPeople(user.id, true);
  const totali = totaliPerPersona(user.id);

  return <PersoneClient personeIniziali={persone} totali={totali} />;
}
