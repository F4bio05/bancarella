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
import { Bottone } from "./ui";

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
 *
 * In modalità `pieno` occupa tutta l'altezza disponibile e i tasti si
 * allargano per riempirla: non c'è mai niente da scorrere, nemmeno su un
 * telefono piccolo. I movimenti della persona stanno dietro un tasto e si
 * aprono sopra il tastierino, invece di allungare la pagina.
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
  pieno,
}: {
  persona: Participant;
  movimenti: Movement[];
  digits: string;
  onDigits: (d: string) => void;
  onRegistra: (amountCents: number) => void;
  onAnnulla: (m: Movement) => void;
  solaLettura?: boolean;
  /** Vista affiancata su tablet: altezze ridotte. */
  compatto?: boolean;
  /** Riempie tutta l'altezza disponibile, senza scorrimento. */
  pieno?: boolean;
}) {
  const [modificaRapidi, setModificaRapidi] = useState(false);
  const [mostraMovimenti, setMostraMovimenti] = useState(false);
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

  // In modalità piena display e tastiera si spartiscono lo spazio libero, con
  // un minimo e un tetto: sotto restano usabili, sopra non si deformano.
  const hDisplay = pieno
    ? "min-h-[4.5rem] max-h-[9.5rem] flex-1"
    : compatto
      ? "h-[4.5rem]"
      : "h-[5.5rem]";
  const dimImporto = pieno
    ? "text-[clamp(2.25rem,9vw,3.75rem)]"
    : compatto
      ? "text-4xl"
      : "text-5xl";
  const hTasto = pieno ? "h-full" : compatto ? "h-[3.25rem]" : "h-14";

  return (
    <div className={`flex flex-col gap-2.5 ${pieno ? "h-full min-h-0" : ""}`}>
      {/* Display dell'importo */}
      <div
        className={`flex items-baseline justify-end gap-2 rounded-2xl border px-5 transition-colors ${
          pieno ? "" : "shrink-0"
        } ${hDisplay} ${
          importo > 0
            ? "border-brand-300 bg-brand-50 dark:border-brand-700 dark:bg-brand-900/40"
            : "border-app surface-2"
        }`}
      >
        <span className="sr-only">Importo</span>
        <span
          className={`tabular self-center font-bold tracking-tight ${dimImporto} ${
            importo > 0 ? "" : "text-muted opacity-35"
          }`}
        >
          {formatEuroPlain(importo)}
        </span>
        <span className="self-center pb-0.5 text-xl font-semibold text-muted">€</span>
      </div>

      {/* Etichette e scorciatoie */}
      <div className="flex shrink-0 items-center justify-between gap-3 px-0.5">
        <span className="text-[11px] font-bold uppercase tracking-wider text-muted">
          Importi rapidi
        </span>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setModificaRapidi((v) => !v)}
            className="text-xs font-semibold text-brand-600 dark:text-brand-300"
          >
            {modificaRapidi ? "Annulla" : "Personalizza"}
          </button>
          {movimenti.length > 0 && (
            <button
              onClick={() => setMostraMovimenti(true)}
              className="surface-2 rounded-full px-2.5 py-1 text-xs font-bold text-muted"
            >
              🕘 {movimenti.length}
            </button>
          )}
        </div>
      </div>

      {modificaRapidi && (
        <p className="shrink-0 px-0.5 text-xs text-muted">
          Digita un importo col tastierino, poi tocca il tasto rapido da sostituire.
        </p>
      )}

      <div className="grid shrink-0 grid-cols-3 gap-2">
        {rapidi.map((v, i) => (
          <button
            key={i}
            onClick={() => {
              vibra();
              if (modificaRapidi) cambiaRapido(i);
              else onDigits(String(v));
            }}
            className={`premi tabular min-h-[44px] rounded-xl border text-[15px] font-bold ${
              modificaRapidi
                ? "border-dashed border-brand-400 text-brand-600 dark:text-brand-300"
                : "border-app surface-2 active:bg-brand-100 dark:active:bg-brand-800"
            }`}
          >
            {formatEuroPlain(v)}
          </button>
        ))}
      </div>

      {/* Tastierino. In modalità piena i tasti si allargano per riempire
          lo spazio che avanza, così non resta mai niente da scorrere. */}
      <div
        className={`relative grid grid-cols-3 gap-2 ${
          // I tasti si adattano allo spazio libero ma con un tetto: senza,
          // su uno schermo alto diventavano rettangoloni sproporzionati.
          pieno ? "max-h-[21rem] min-h-[11rem] flex-[1.7] grid-rows-4" : ""
        }`}
      >
        {TASTI.map((t) => (
          <button
            key={t}
            onClick={() => premi(t)}
            aria-label={t === "⌫" ? "Cancella" : t}
            className={`premi flex items-center justify-center rounded-2xl border border-app text-2xl font-bold active:bg-brand-100 dark:active:bg-brand-800 ${hTasto} ${
              t === "⌫" ? "surface-2 text-muted" : "surface ombra-1"
            }`}
          >
            {t}
          </button>
        ))}

        {mostraMovimenti && (
          <div className="animate-fade surface absolute inset-0 z-10 flex flex-col overflow-hidden rounded-2xl border border-app">
            <div className="flex shrink-0 items-center justify-between border-b border-app px-3 py-2">
              <span className="text-sm font-bold">Movimenti di {persona.name.split(" ")[0]}</span>
              <button
                onClick={() => setMostraMovimenti(false)}
                className="premi surface-2 rounded-lg px-3 py-1.5 text-xs font-bold text-muted"
              >
                Chiudi
              </button>
            </div>
            <ul className="flex-1 divide-y divide-[var(--border)] overflow-y-auto overscroll-contain">
              {movimenti.map((m) => (
                <li key={m.id} className="flex items-center gap-3 px-3 py-2.5">
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
                      className="premi surface-2 rounded-lg px-3 py-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400"
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

      {/* Azioni */}
      <div className="flex shrink-0 gap-2">
        <Bottone
          variante="pericolo"
          disabled={importo <= 0 || solaLettura}
          onClick={() => registra(-1)}
          className="!min-h-[54px] min-w-[34%] flex-1 text-[17px]"
        >
          − Rimuovi
        </Bottone>
        <Bottone
          variante="successo"
          disabled={importo <= 0 || solaLettura}
          onClick={() => registra(1)}
          className="!min-h-[54px] flex-[1.8] text-[18px]"
        >
          ＋ Aggiungi
        </Bottone>
      </div>

      {solaLettura && (
        <p className="shrink-0 text-center text-sm text-muted">
          La giornata è chiusa: riaprila dallo storico per modificarla.
        </p>
      )}
    </div>
  );
}
