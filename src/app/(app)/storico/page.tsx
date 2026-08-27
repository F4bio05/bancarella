import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { listDays, totaliPerPersona } from "@/lib/store";
import { StoricoClient } from "@/components/StoricoClient";

export const metadata = { title: "Storico — Bancarella" };
export const dynamic = "force-dynamic";

export default async function StoricoPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return <StoricoClient giornate={listDays(user.id)} totali={totaliPerPersona(user.id)} />;
}
