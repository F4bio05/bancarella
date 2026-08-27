import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { StoreError, getDayState } from "@/lib/store";
import type { DayState } from "@/lib/types";
import { DettaglioGiornata } from "@/components/DettaglioGiornata";

export const dynamic = "force-dynamic";

export default async function DettaglioPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();

  let stato: DayState;
  try {
    stato = getDayState(user.id, id);
  } catch (err) {
    if (err instanceof StoreError && err.status === 404) notFound();
    throw err;
  }

  return <DettaglioGiornata stato={stato} />;
}
