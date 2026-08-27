"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { api } from "@/lib/client";
import { svuotaCacheUtente } from "@/lib/local";
import {
  ETICHETTE,
  TEMI,
  impostaTema,
  osservaTema,
  temaCorrente,
  temaSuccessivo,
  temaSulServer,
} from "@/lib/tema";

const VOCI = [
  { href: "/giornata", label: "Giornata", icona: "🧺" },
  { href: "/persone", label: "Persone", icona: "👥" },
  { href: "/storico", label: "Storico", icona: "📅" },
];

function useEsci() {
  const router = useRouter();
  const [uscita, setUscita] = useState(false);
  const esci = async () => {
    setUscita(true);
    try {
      await api("/api/auth/logout", { method: "POST" });
    } catch {
      /* si esce comunque */
    }
    svuotaCacheUtente();
    router.replace("/login");
  };
  return { esci, uscita };
}

function useTema() {
  return useSyncExternalStore(osservaTema, temaCorrente, temaSulServer);
}

/** Tre pulsanti affiancati: usato nella colonna laterale. */
export function SelettoreTema() {
  const tema = useTema();
  return (
    <div className="surface-2 flex rounded-full p-1">
      {TEMI.map((t) => (
        <button
          key={t}
          onClick={() => impostaTema(t)}
          aria-pressed={tema === t}
          title={ETICHETTE[t].nome}
          className={`flex-1 rounded-full py-2 text-base ${tema === t ? "surface" : "opacity-50"}`}
        >
          {ETICHETTE[t].icona}
        </button>
      ))}
    </div>
  );
}

/** Un solo tasto che cicla tra i temi: usato nelle intestazioni su telefono. */
export function BottoneTema() {
  const tema = useTema();
  return (
    <button
      onClick={() => impostaTema(temaSuccessivo(tema))}
      title={`Tema: ${ETICHETTE[tema].nome}`}
      aria-label={`Tema: ${ETICHETTE[tema].nome}. Toccare per cambiare.`}
      className="surface-2 flex h-10 w-10 items-center justify-center rounded-full text-base"
    >
      {ETICHETTE[tema].icona}
    </button>
  );
}

export function Nav({ nome }: { nome: string }) {
  const path = usePathname();
  const { esci, uscita } = useEsci();
  const attivo = (href: string) => path === href || path.startsWith(`${href}/`);
  const senzaColonna = path === "/giornata";

  return (
    <>
      {/* Barra inferiore (telefono) */}
      <nav className="surface safe-bottom fixed inset-x-0 bottom-0 z-40 grid grid-cols-3 border-t border-app md:hidden">
        {VOCI.map((v) => (
          <Link
            key={v.href}
            href={v.href}
            className={`flex flex-col items-center gap-0.5 pt-2 text-[11px] font-semibold ${
              attivo(v.href) ? "text-brand-600 dark:text-brand-300" : "text-muted"
            }`}
          >
            <span className="text-2xl leading-none">{v.icona}</span>
            {v.label}
          </Link>
        ))}
      </nav>

      {/* Colonna laterale (tablet e desktop), tranne nella giornata:
          li' lo spazio serve tutto a elenco e tastierino. */}
      <aside
        className={`surface w-60 shrink-0 flex-col border-r border-app p-4 ${
          senzaColonna ? "hidden" : "hidden md:flex"
        }`}
      >
        <div className="mb-6 px-2">
          <p className="text-lg font-bold">Bancarella</p>
          <p className="truncate text-sm text-muted">{nome}</p>
        </div>
        <div className="flex flex-col gap-1">
          {VOCI.map((v) => (
            <Link
              key={v.href}
              href={v.href}
              className={`flex items-center gap-3 rounded-2xl px-3 py-3 text-[16px] font-semibold ${
                attivo(v.href)
                  ? "bg-brand-100 text-brand-700 dark:bg-brand-800 dark:text-brand-100"
                  : "text-muted active:surface-2"
              }`}
            >
              <span className="text-xl">{v.icona}</span>
              {v.label}
            </Link>
          ))}
        </div>
        <div className="mt-auto flex flex-col gap-2">
          <SelettoreTema />
          <button
            onClick={esci}
            disabled={uscita}
            className="rounded-2xl px-3 py-3 text-left text-sm font-semibold text-muted active:surface-2"
          >
            ↩︎ Esci
          </button>
        </div>
      </aside>
    </>
  );
}

/**
 * Controlli per la schermata della giornata, che non ha la colonna laterale:
 * su tablet/PC compaiono anche i collegamenti alle altre sezioni (su telefono
 * ci pensa già la barra in basso).
 */
export function AzioniGiornata() {
  const { esci, uscita } = useEsci();
  return (
    <div className="flex shrink-0 items-center gap-2">
      {VOCI.filter((v) => v.href !== "/giornata").map((v) => (
        <Link
          key={v.href}
          href={v.href}
          title={v.label}
          className="surface-2 hidden h-10 w-10 items-center justify-center rounded-full text-base md:flex"
        >
          {v.icona}
        </Link>
      ))}
      <BottoneTema />
      <button
        onClick={esci}
        disabled={uscita}
        className="surface-2 rounded-full px-4 py-2 text-sm font-semibold text-muted"
      >
        Esci
      </button>
    </div>
  );
}

/** Tema + uscita, in alto a destra nelle schermate su telefono. */
export function AzioniIntestazione() {
  const { esci, uscita } = useEsci();
  return (
    <div className="flex shrink-0 items-center gap-2 md:hidden">
      <BottoneTema />
      <button
        onClick={esci}
        disabled={uscita}
        className="surface-2 rounded-full px-4 py-2 text-sm font-semibold text-muted"
      >
        Esci
      </button>
    </div>
  );
}
