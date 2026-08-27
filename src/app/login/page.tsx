import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { FormAccesso } from "@/components/FormAccesso";

export const metadata = { title: "Accedi — Bancarella" };

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/giornata");
  return <FormAccesso modo="login" />;
}
