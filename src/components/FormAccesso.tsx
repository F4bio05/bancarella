"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client";
import { svuotaCacheUtente } from "@/lib/local";
import { Avviso, Bottone } from "./ui";

const CAMPO =
  "w-full rounded-2xl border border-app surface px-4 py-3.5 text-[16px] outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/25";

export function FormAccesso({ modo }: { modo: "login" | "registrazione" }) {
  const router = useRouter();
  const registrazione = modo === "registrazione";
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errore, setErrore] = useState<string | null>(null);
  const [inCorso, setInCorso] = useState(false);

  const invia = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrore(null);
    setInCorso(true);
    try {
      await api(registrazione ? "/api/auth/register" : "/api/auth/login", {
        method: "POST",
        body: registrazione ? { name: nome, email, password } : { email, password },
      });
      // Cambio account: la cache locale del precedente non serve piu'.
      svuotaCacheUtente();
      router.replace("/giornata");
    } catch (err) {
      setErrore(err instanceof Error ? err.message : "Accesso non riuscito");
      setInCorso(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col justify-center gap-6 px-5 py-10 safe-top">
      <div className="text-center">
        <div className="grad-brand ombra-2 mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl text-3xl">
          🧺
        </div>
        <h1 className="text-2xl font-bold">Bancarella</h1>
        <p className="mt-1 text-sm text-muted">
          Il conto di ogni persona che ti dà dei vestiti da vendere.
        </p>
      </div>

      <form
        onSubmit={invia}
        className="surface flex flex-col gap-3 rounded-3xl border border-app p-5"
      >
        <h2 className="text-lg font-bold">{registrazione ? "Crea il tuo account" : "Accedi"}</h2>

        {errore && <Avviso onChiudi={() => setErrore(null)}>{errore}</Avviso>}

        {registrazione && (
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold text-muted">Il tuo nome</span>
            <input
              className={CAMPO}
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              autoComplete="name"
              required
              placeholder="Es. Fabio"
            />
          </label>
        )}

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold text-muted">Email</span>
          <input
            className={CAMPO}
            type="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            autoCapitalize="none"
            required
            placeholder="tu@esempio.it"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold text-muted">Password</span>
          <input
            className={CAMPO}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={registrazione ? "new-password" : "current-password"}
            required
            minLength={registrazione ? 6 : undefined}
            placeholder={registrazione ? "Almeno 6 caratteri" : "••••••••"}
          />
        </label>

        <Bottone type="submit" full disabled={inCorso} className="mt-1">
          {inCorso ? "Attendi…" : registrazione ? "Crea account" : "Entra"}
        </Bottone>

        <p className="pt-1 text-center text-sm text-muted">
          {registrazione ? (
            <>
              Hai già un account?{" "}
              <Link href="/login" className="font-semibold text-brand-600 dark:text-brand-300">
                Accedi
              </Link>
            </>
          ) : (
            <>
              Prima volta qui?{" "}
              <Link href="/registrati" className="font-semibold text-brand-600 dark:text-brand-300">
                Registrati
              </Link>
            </>
          )}
        </p>
      </form>
    </div>
  );
}
