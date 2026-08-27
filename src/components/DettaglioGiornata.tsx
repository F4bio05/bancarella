"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { api } from "@/lib/client";
import { formatDataLunga, formatEuro, formatEuroPlain, formatOra } from "@/lib/format";
import { ricordaGiornata } from "@/lib/local";
import type { DayState } from "@/lib/types";
import { Avviso, Bottone, Pallino, Pannello } from "./ui";
import { AzioniIntestazione } from "./Nav";

export function DettaglioGiornata({ stato }: { stato: DayState }) {
  const router = useRouter();
  const { day, participants, movements } = stato;
  const [errore, setErrore] = useState<string | null>(null);
  const [inCorso, setInCorso] = useState(false);
  const [pannelloElimina, setPannelloElimina] = useState(false);
  const [copiato, setCopiato] = useState(false);

  const ordinati = useMemo(
    () => [...participants].sort((a, b) => b.totalCents - a.totalCents),
    [participants],
  );

  const riepilogo = useMemo(() => {
    const righe = [
      `${day.label ? `${day.label} — ` : ""}${formatDataLunga(day.date)}`,
      `Totale: ${formatEuroPlain(day.totalCents)} € (${day.itemsCount} articoli)`,
      "",
      ...ordinati.map((p) => `• ${p.name}: ${formatEuroPlain(p.totalCents)} € (${p.items} art.)`),
    ];
    return righe.join("\n");
  }, [day, ordinati]);

  const copia = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ text: riepilogo });
      } else {
        await navigator.clipboard.writeText(riepilogo);
        setCopiato(true);
        setTimeout(() => setCopiato(false), 2000);
      }
    } catch {
      /* condivisione annullata */
    }
  };

  const riapri = async () => {
    setInCorso(true);
    setErrore(null);
    try {
      await api(`/api/days/${day.id}/reopen`, { method: "POST" });
      ricordaGiornata(day.id);
      router.push("/giornata");
    } catch (err) {
      setErrore(err instanceof Error ? err.message : "Non riuscito");
      setInCorso(false);
    }
  };

  const elimina = async () => {
    setInCorso(true);
    setErrore(null);
    try {
      await api(`/api/days/${day.id}`, { method: "DELETE" });
      router.push("/storico");
    } catch (err) {
      setErrore(err instanceof Error ? err.message : "Non riuscito");
      setInCorso(false);
    }
  };

  const nome = (personId: number) => participants.find((p) => p.personId === personId)?.name ?? "—";

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pt-4 safe-top">
      <header className="mb-4">
        <div className="mb-2 flex items-start justify-between gap-3">
          <Link href="/storico" className="text-sm font-semibold text-muted">
            ‹ Storico
          </Link>
          <AzioniIntestazione />
        </div>
        <h1 className="text-2xl font-bold">{day.label ?? "Giornata"}</h1>
        <p className="text-sm text-muted">{formatDataLunga(day.date)}</p>
      </header>

      {errore && (
        <div className="mb-3">
          <Avviso onChiudi={() => setErrore(null)}>{errore}</Avviso>
        </div>
      )}

      {day.status === "open" && (
        <div className="mb-3">
          <Avviso tipo="info">
            Questa giornata è ancora aperta.{" "}
            <Link href="/giornata" className="font-bold underline">
              Vai alla giornata
            </Link>
          </Avviso>
        </div>
      )}

      <div className="mb-4 rounded-3xl bg-brand-600 px-5 py-4 text-white">
        <p className="text-sm font-semibold text-brand-100">Incasso</p>
        <p className="tabular text-4xl font-bold">{formatEuro(day.totalCents)}</p>
        <div className="mt-2 flex flex-wrap gap-x-4 text-sm text-brand-100">
          <span>
            {day.itemsCount} {day.itemsCount === 1 ? "articolo" : "articoli"}
          </span>
          <span>
            {participants.length} {participants.length === 1 ? "persona" : "persone"}
          </span>
          {day.closedAt && <span>chiusa alle {formatOra(day.closedAt)}</span>}
        </div>
      </div>

      <h2 className="mb-2 font-bold">Totale per persona</h2>
      <ul className="mb-4 divide-y divide-[var(--border)] overflow-hidden rounded-3xl border border-app">
        {ordinati.map((p) => (
          <li key={p.personId} className="surface flex items-center gap-3 px-4 py-3">
            <Pallino nome={p.name} size="h-11 w-11 text-sm" />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold">{p.name}</span>
              <span className="block text-xs text-muted">
                {p.items} {p.items === 1 ? "articolo" : "articoli"}
              </span>
            </span>
            <span className="tabular text-lg font-bold">{formatEuro(p.totalCents)}</span>
          </li>
        ))}
        {ordinati.length === 0 && (
          <li className="surface px-4 py-6 text-center text-sm text-muted">
            Nessuna persona in questa giornata
          </li>
        )}
      </ul>

      {movements.length > 0 && (
        <>
          <h2 className="mb-2 font-bold">Movimenti ({movements.length})</h2>
          <ul className="mb-4 divide-y divide-[var(--border)] overflow-hidden rounded-3xl border border-app">
            {movements.map((m) => (
              <li key={m.id} className="surface flex items-center gap-3 px-4 py-2.5">
                <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                  {nome(m.personId)}
                </span>
                <span className="text-xs text-muted">{formatOra(m.createdAt)}</span>
                <span
                  className={`tabular w-24 text-right font-bold ${
                    m.amountCents > 0
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-rose-600 dark:text-rose-400"
                  }`}
                >
                  {formatEuro(m.amountCents, true)}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}

      <div className="mb-8 flex flex-col gap-2">
        <Bottone variante="neutro" full onClick={() => void copia()}>
          {copiato ? "✓ Riepilogo copiato" : "Condividi / copia riepilogo"}
        </Bottone>
        {day.status === "closed" && (
          <Bottone variante="neutro" full disabled={inCorso} onClick={() => void riapri()}>
            Riapri questa giornata
          </Bottone>
        )}
        <Bottone variante="fantasma" full onClick={() => setPannelloElimina(true)}>
          Elimina giornata
        </Bottone>
      </div>

      <Pannello
        aperto={pannelloElimina}
        onChiudi={() => setPannelloElimina(false)}
        titolo="Eliminare la giornata?"
        sottotitolo={formatDataLunga(day.date)}
      >
        <div className="flex flex-col gap-3">
          <Avviso tipo="errore">
            Vengono cancellati tutti i {movements.length} movimenti e i totali di questa giornata.
            L&apos;operazione non si può annullare.
          </Avviso>
          <Bottone variante="pericolo" full disabled={inCorso} onClick={() => void elimina()}>
            {inCorso ? "Elimino…" : "Sì, elimina"}
          </Bottone>
          <Bottone variante="neutro" full onClick={() => setPannelloElimina(false)}>
            Annulla
          </Bottone>
        </div>
      </Pannello>
    </div>
  );
}
