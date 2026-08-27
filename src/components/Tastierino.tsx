"use client";

import { useState, useSyncExternalStore } from "react";
import { formatEuro, formatEuroPlain, formatOra } from "@/lib/format";
import {
  importiRapidi,
  importiRapidiSulServer,
  osservaImportiRapidi,
  salvaImportiRapidi,
} from "@/lib/local";
import type { Movement, Participant } from "@/lib/types";
import { Bottone, Pallino } from "./ui";

const TASTI = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "00", "0", "⌫"];

function vibra(ms = 8) {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* non supportato */
  }
}

/**
 * Tastierino in stile registratore di cassa: le cifre entrano da destra,
 * quindi "500" significa 5,00 €. Nessun bisogno di digitare la virgola.
 */
export function Tastierino({
  persona,
  movimenti,
  digits,
  onDigits,
  onRegistra,
  onAnnulla,
  solaLettura,
  compatto,
}: {
  persona: Participant;
  movimenti: Movement[];
  digits: string;
  onDigits: (d: string) => void;
  onRegistra: (amountCents: number) => void;
  onAnnulla: (m: Movement) => void;
  solaLettura?: boolean;
  /** Vista affiancata su tablet: altezze ridotte per stare in una schermata. */
  compatto?: boolean;
}) {
  const [modificaRapidi, setModificaRapidi] = useState(false);
  const rapidi = useSyncExternalStore(osservaImportiRapidi, importiRapidi, importiRapidiSulServer);

  const importo = Number(digits || "0");

  const premi = (t: string) => {
    vibra();
    if (t === "⌫") {
      onDigits(digits.slice(0, -1));
      return;
    }
    const next = (digits + t).replace(/^0+(?=\d)/, "");
    if (next.length > 7) return; // max 99.999,99
    onDigits(next);
  };

  const registra = (segno: 1 | -1) => {
    if (importo <= 0 || solaLettura) return;
    vibra(18);
    onDigits("");
    // La persona viene deselezionata da chi ci sta sopra: si evita di
    // caricare per sbaglio un secondo articolo sullo stesso nome.
    onRegistra(segno * importo);
  };

  const cambiaRapido = (i: number) => {
    if (importo <= 0) return;
    salvaImportiRapidi(rapidi.map((v, k) => (k === i ? importo : v)));
    setModificaRapidi(false);
    onDigits("");
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Saldo della persona */}
      <div className="surface-2 flex items-center gap-3 rounded-2xl px-4 py-3">
        <Pallino nome={persona.name} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{persona.name}</p>
          <p className="text-xs text-muted">
            {persona.items} {persona.items === 1 ? "articolo" : "articoli"} venduti oggi
          </p>
        </div>
        <div className="text-right">
          <p className="tabular text-2xl font-bold text-brand-600 dark:text-brand-300">
            {formatEuro(persona.totalCents)}
          </p>
        </div>
      </div>

      {/* Display importo */}
      <div className="relative">
        <div
          className={`flex items-center justify-end rounded-2xl border-2 px-5 transition-colors ${
            compatto ? "h-20" : "h-24"
          } ${importo > 0 ? "border-brand-400 surface" : "border-app surface-2"}`}
        >
          <span
            className={`tabular font-bold ${compatto ? "text-4xl" : "text-5xl"} ${
              importo > 0 ? "" : "text-muted opacity-40"
            }`}
          >
            {formatEuroPlain(importo)}
          </span>
          <span className="ml-2 text-2xl font-semibold text-muted">€</span>
        </div>
      </div>

      {/* Importi rapidi */}
      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted">
            Importi rapidi
          </span>
          <button
            onClick={() => setModificaRapidi((v) => !v)}
            className="text-xs font-semibold text-brand-600 dark:text-brand-300"
          >
            {modificaRapidi ? "Annulla" : "Personalizza"}
          </button>
        </div>
        {modificaRapidi && (
          <p className="mb-2 text-xs text-muted">
            Digita un importo col tastierino, poi tocca il tasto rapido da sostituire.
          </p>
        )}
        <div className="grid grid-cols-3 gap-2">
          {rapidi.map((v, i) => (
            <button
              key={i}
              onClick={() => {
                vibra();
                if (modificaRapidi) cambiaRapido(i);
                else onDigits(String(v));
              }}
              className={`tabular min-h-[46px] rounded-xl border text-[15px] font-bold ${
                modificaRapidi
                  ? "border-dashed border-brand-400 text-brand-600 dark:text-brand-300"
                  : "border-app surface-2 active:bg-brand-100 dark:active:bg-brand-800"
              }`}
            >
              {formatEuroPlain(v)}
            </button>
          ))}
        </div>
      </div>

      {/* Tastierino */}
      <div className="grid grid-cols-3 gap-2">
        {TASTI.map((t) => (
          <button
            key={t}
            onClick={() => premi(t)}
            className={`flex items-center justify-center rounded-2xl border border-app text-2xl font-bold active:scale-[0.97] active:bg-brand-100 dark:active:bg-brand-800 ${
              compatto ? "h-14" : "h-16"
            } ${t === "⌫" ? "surface-2 text-muted" : "surface"}`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Azioni */}
      <div className="flex gap-2">
        <Bottone
          variante="pericolo"
          disabled={importo <= 0 || solaLettura}
          onClick={() => registra(-1)}
          className={`min-w-[38%] flex-1 text-[18px] ${
            compatto ? "!min-h-[56px]" : "!min-h-[62px]"
          }`}
        >
          − Rimuovi
        </Bottone>
        <Bottone
          variante="successo"
          disabled={importo <= 0 || solaLettura}
          onClick={() => registra(1)}
          className={`flex-[1.6] text-[19px] ${compatto ? "!min-h-[56px]" : "!min-h-[62px]"}`}
        >
          ＋ Aggiungi al saldo
        </Bottone>
      </div>
      {solaLettura && (
        <p className="text-center text-sm text-muted">
          La giornata è chiusa: riaprila dallo storico per modificarla.
        </p>
      )}

      {/* Movimenti della persona */}
      {movimenti.length > 0 && (
        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
            Movimenti di {persona.name.split(" ")[0]}
          </p>
          <ul className="divide-y divide-[var(--border)] overflow-hidden rounded-2xl border border-app">
            {movimenti.slice(0, compatto ? 6 : 12).map((m) => (
              <li key={m.id} className="surface flex items-center gap-3 px-3 py-2.5">
                <span
                  className={`tabular flex-1 font-bold ${
                    m.amountCents > 0
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-rose-600 dark:text-rose-400"
                  }`}
                >
                  {formatEuro(m.amountCents, true)}
                </span>
                <span className="text-xs text-muted">
                  {m.id < 0 ? "in attesa…" : formatOra(m.createdAt)}
                </span>
                {!solaLettura && (
                  <button
                    onClick={() => {
                      vibra();
                      onAnnulla(m);
                    }}
                    className="surface-2 rounded-lg px-3 py-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400"
                  >
                    Annulla
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
