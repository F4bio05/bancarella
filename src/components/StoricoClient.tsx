"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { formatDataBreve, formatEuro } from "@/lib/format";
import type { DaySummary } from "@/lib/types";
import { Pallino, Vuoto } from "./ui";
import { AzioniIntestazione } from "./Nav";

type Totale = { personId: number; name: string; totalCents: number; days: number; items: number };

export function StoricoClient({ giornate, totali }: { giornate: DaySummary[]; totali: Totale[] }) {
  const [vista, setVista] = useState<"giornate" | "persone">("giornate");

  const perAnnoMese = useMemo(() => {
    const gruppi = new Map<string, DaySummary[]>();
    for (const g of giornate) {
      const k = g.date.slice(0, 7);
      const l = gruppi.get(k) ?? [];
      l.push(g);
      gruppi.set(k, l);
    }
    return [...gruppi.entries()];
  }, [giornate]);

  const totaleGenerale = giornate
    .filter((g) => g.status === "closed")
    .reduce((s, g) => s + g.totalCents, 0);

  const MESI = [
    "Gennaio",
    "Febbraio",
    "Marzo",
    "Aprile",
    "Maggio",
    "Giugno",
    "Luglio",
    "Agosto",
    "Settembre",
    "Ottobre",
    "Novembre",
    "Dicembre",
  ];

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pt-4 safe-top">
      <header className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Storico</h1>
          <p className="text-sm text-muted">
            {giornate.length} {giornate.length === 1 ? "giornata" : "giornate"} · incassato{" "}
            <span className="tabular font-semibold">{formatEuro(totaleGenerale)}</span>
          </p>
        </div>
        <AzioniIntestazione />
      </header>

      <div className="surface-2 mb-4 flex rounded-full p-1 text-sm font-semibold">
        {(["giornate", "persone"] as const).map((v) => (
          <button
            key={v}
            onClick={() => setVista(v)}
            className={`flex-1 rounded-full px-4 py-2.5 ${
              vista === v ? "surface text-brand-600 dark:text-brand-300" : "text-muted"
            }`}
          >
            {v === "giornate" ? "Per giornata" : "Totali per persona"}
          </button>
        ))}
      </div>

      {vista === "giornate" ? (
        giornate.length === 0 ? (
          <div className="surface rounded-3xl border border-app">
            <Vuoto
              icona="📅"
              titolo="Nessuna giornata salvata"
              testo="Quando chiudi una giornata la trovi qui, con il dettaglio per ogni persona."
            />
          </div>
        ) : (
          <div className="flex flex-col gap-5 pb-8">
            {perAnnoMese.map(([mese, list]) => {
              const [y, m] = mese.split("-");
              const somma = list.reduce((s, g) => s + g.totalCents, 0);
              return (
                <section key={mese}>
                  <div className="mb-1.5 flex items-baseline justify-between px-1">
                    <h2 className="text-sm font-bold uppercase tracking-wide text-muted">
                      {MESI[Number(m) - 1]} {y}
                    </h2>
                    <span className="tabular text-sm font-semibold text-muted">
                      {formatEuro(somma)}
                    </span>
                  </div>
                  <ul className="divide-y divide-[var(--border)] overflow-hidden rounded-3xl border border-app">
                    {list.map((g) => (
                      <li key={g.id}>
                        <Link
                          href={`/storico/${g.id}`}
                          className="surface flex items-center gap-3 px-4 py-3.5 active:surface-2"
                        >
                          <span className="surface-2 flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-2xl">
                            <span className="text-lg font-bold leading-none">
                              {Number(g.date.slice(8, 10))}
                            </span>
                            <span className="text-[10px] uppercase text-muted">
                              {MESI[Number(m) - 1].slice(0, 3)}
                            </span>
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-semibold">
                              {g.label ?? formatDataBreve(g.date)}
                              {g.status === "open" && (
                                <span className="ml-2 rounded-full bg-amber-500/20 px-2 py-0.5 text-[11px] font-bold text-amber-700 dark:text-amber-300">
                                  aperta
                                </span>
                              )}
                            </span>
                            <span className="block text-xs text-muted">
                              {g.peopleCount} {g.peopleCount === 1 ? "persona" : "persone"} ·{" "}
                              {g.itemsCount} {g.itemsCount === 1 ? "articolo" : "articoli"}
                            </span>
                          </span>
                          <span className="tabular shrink-0 text-lg font-bold">
                            {formatEuro(g.totalCents)}
                          </span>
                          <span className="shrink-0 text-muted">›</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
        )
      ) : totali.length === 0 ? (
        <div className="surface rounded-3xl border border-app">
          <Vuoto
            icona="🧮"
            titolo="Ancora nessun totale"
            testo="Apri una giornata e inizia a vendere."
          />
        </div>
      ) : (
        <ul className="mb-8 divide-y divide-[var(--border)] overflow-hidden rounded-3xl border border-app">
          {totali.map((t) => (
            <li key={t.personId} className="surface flex items-center gap-3 px-4 py-3.5">
              <Pallino nome={t.name} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[17px] font-semibold">{t.name}</span>
                <span className="block text-xs text-muted">
                  {t.days} {t.days === 1 ? "giornata" : "giornate"} · {t.items} articoli
                </span>
              </span>
              <span className="tabular shrink-0 text-lg font-bold text-brand-600 dark:text-brand-300">
                {formatEuro(t.totalCents)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
