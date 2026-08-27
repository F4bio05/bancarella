"use client";

import { useEffect, type ReactNode } from "react";

/* --------------------------------- bottone -------------------------------- */

type Variante = "primario" | "neutro" | "pericolo" | "fantasma" | "successo";

const VARIANTI: Record<Variante, string> = {
  primario: "grad-brand text-white ombra-1 disabled:opacity-45",
  successo: "grad-brand text-white ombra-1 disabled:opacity-45",
  pericolo: "bg-rose-600 text-white ombra-1 active:bg-rose-700 disabled:opacity-45",
  neutro: "surface border border-app text-[var(--text)] active:surface-2",
  fantasma: "text-muted active:surface-2",
};

export function Bottone({
  children,
  variante = "primario",
  className = "",
  full,
  ...rest
}: {
  children: ReactNode;
  variante?: Variante;
  full?: boolean;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      className={`premi inline-flex min-h-[50px] items-center justify-center gap-2 rounded-2xl px-5 text-[16px] font-semibold disabled:pointer-events-none ${
        VARIANTI[variante]
      } ${full ? "w-full" : ""} ${className}`}
    >
      {children}
    </button>
  );
}

/* ---------------------------------- card --------------------------------- */

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`surface ombra-1 rounded-3xl border border-app ${className}`}>{children}</div>
  );
}

/* -------------------------------- pannello ------------------------------- */

/**
 * Bottom sheet su telefono, finestra centrata su tablet.
 *
 * `pieno` lo porta a tutta altezza sul telefono e `scorrevole={false}` toglie
 * lo scorrimento: il contenuto si adatta allo spazio disponibile. È così che
 * il tastierino sta sempre in una schermata sola.
 */
export function Pannello({
  aperto,
  onChiudi,
  titolo,
  sottotitolo,
  intestazione,
  children,
  larghezza = "max-w-lg",
  pieno,
  scorrevole = true,
}: {
  aperto: boolean;
  onChiudi: () => void;
  titolo?: ReactNode;
  sottotitolo?: ReactNode;
  /** Sostituisce titolo e sottotitolo con un contenuto qualsiasi. */
  intestazione?: ReactNode;
  children: ReactNode;
  larghezza?: string;
  pieno?: boolean;
  scorrevole?: boolean;
}) {
  useEffect(() => {
    if (!aperto) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onChiudi();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [aperto, onChiudi]);

  if (!aperto) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <button
        aria-label="Chiudi"
        onClick={onChiudi}
        className="animate-fade absolute inset-0 bg-black/50 backdrop-blur-[3px]"
      />
      <div
        role="dialog"
        aria-modal="true"
        className={`animate-sheet surface ombra-3 relative flex w-full ${larghezza} flex-col overflow-hidden border border-app ${
          pieno
            ? // Anche da tablet il pannello deve avere un'altezza definita:
              // con `h-auto` i tasti non avrebbero spazio da riempire e
              // collasserebbero all'altezza minima.
              "h-[100dvh] rounded-none sm:h-[min(92dvh,44rem)] sm:rounded-3xl"
            : "max-h-[92dvh] rounded-t-3xl sm:rounded-3xl"
        }`}
      >
        <div className="flex shrink-0 items-center gap-3 border-b border-app px-4 pb-3 safe-top">
          <div className="min-w-0 flex-1">
            {intestazione ?? (
              <>
                {titolo && <h2 className="truncate text-xl font-bold">{titolo}</h2>}
                {sottotitolo && <p className="mt-0.5 text-sm text-muted">{sottotitolo}</p>}
              </>
            )}
          </div>
          <button
            onClick={onChiudi}
            aria-label="Chiudi"
            className="premi surface-2 -mr-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg text-muted"
          >
            ✕
          </button>
        </div>

        <div
          className={
            scorrevole
              ? "flex-1 overflow-y-auto overscroll-contain px-4 py-4 safe-bottom"
              : "flex min-h-0 flex-1 flex-col overflow-hidden px-4 pt-3 safe-bottom"
          }
        >
          {children}
        </div>
      </div>
    </div>
  );
}

/* --------------------------------- avviso -------------------------------- */

export function Avviso({
  tipo = "errore",
  children,
  onChiudi,
}: {
  tipo?: "errore" | "info" | "ok";
  children: ReactNode;
  onChiudi?: () => void;
}) {
  const stile = {
    errore: "bg-rose-500/12 text-rose-700 dark:text-rose-300 border-rose-500/25",
    info: "bg-amber-500/12 text-amber-800 dark:text-amber-200 border-amber-500/25",
    ok: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 border-emerald-500/25",
  }[tipo];
  return (
    <div className={`flex items-start gap-2 rounded-2xl border px-4 py-3 text-sm ${stile}`}>
      <span className="flex-1">{children}</span>
      {onChiudi && (
        <button onClick={onChiudi} aria-label="Chiudi avviso" className="px-1 font-bold">
          ✕
        </button>
      )}
    </div>
  );
}

/* ------------------------------- iniziali -------------------------------- */

const TINTE = [
  "bg-rose-500",
  "bg-orange-500",
  "bg-amber-500",
  "bg-lime-600",
  "bg-emerald-500",
  "bg-teal-500",
  "bg-sky-500",
  "bg-indigo-500",
  "bg-violet-500",
  "bg-fuchsia-500",
];

export function tintaDaNome(nome: string): string {
  let h = 0;
  for (let i = 0; i < nome.length; i++) h = (h * 31 + nome.charCodeAt(i)) % 9973;
  return TINTE[h % TINTE.length];
}

export function iniziali(nome: string): string {
  const parti = nome.trim().split(/\s+/);
  return ((parti[0]?.[0] ?? "") + (parti[1]?.[0] ?? "")).toUpperCase() || "?";
}

export function Pallino({ nome, size = "h-11 w-11 text-sm" }: { nome: string; size?: string }) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full font-bold tracking-wide text-white ring-2 ring-white/25 ${size} ${tintaDaNome(nome)}`}
    >
      {iniziali(nome)}
    </span>
  );
}

/* ------------------------------ card persona ----------------------------- */

/** Chi è la persona e a quanto sta: sostituisce il titolo del tastierino. */
export function CardPersona({
  nome,
  totaleCents,
  articoli,
  azione,
}: {
  nome: string;
  totaleCents: number;
  articoli: number;
  azione?: ReactNode;
}) {
  const abs = Math.abs(totaleCents);
  const euro = `${totaleCents < 0 ? "-" : ""}${Math.floor(abs / 100).toLocaleString("it-IT")},${String(
    abs % 100,
  ).padStart(2, "0")} €`;

  return (
    <div className="flex items-center gap-3">
      <Pallino nome={nome} size="h-12 w-12 text-base" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[17px] font-bold leading-tight">{nome}</p>
        <p className="text-xs text-muted">
          {articoli} {articoli === 1 ? "articolo venduto" : "articoli venduti"}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="tabular text-2xl font-bold leading-tight text-brand-600 dark:text-brand-300">
          {euro}
        </p>
        {azione}
      </div>
    </div>
  );
}

/* --------------------------------- vuoto --------------------------------- */

export function Vuoto({
  icona,
  titolo,
  testo,
  azione,
}: {
  icona: string;
  titolo: string;
  testo?: string;
  azione?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
      <span className="surface-2 flex h-16 w-16 items-center justify-center rounded-2xl text-3xl">
        {icona}
      </span>
      <h3 className="text-lg font-bold">{titolo}</h3>
      {testo && <p className="max-w-sm text-sm text-muted">{testo}</p>}
      {azione}
    </div>
  );
}
