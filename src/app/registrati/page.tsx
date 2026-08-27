import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { FormAccesso } from "@/components/FormAccesso";

export const metadata = { title: "Registrati — Bancarella" };

export default async function RegistratiPage() {
  if (await getCurrentUser()) redirect("/giornata");
  return <FormAccesso modo="registrazione" />;
}
