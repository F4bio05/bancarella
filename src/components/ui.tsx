"use client";

import { useEffect, type ReactNode } from "react";

/* --------------------------------- bottone -------------------------------- */

type Variante = "primario" | "neutro" | "pericolo" | "fantasma" | "successo";

const VARIANTI: Record<Variante, string> = {
  primario: "bg-brand-600 text-white active:bg-brand-700 disabled:bg-brand-600/40",
  successo: "bg-emerald-600 text-white active:bg-emerald-700 disabled:bg-emerald-600/40",
  pericolo: "bg-rose-600 text-white active:bg-rose-700 disabled:bg-rose-600/40",
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
      className={`inline-flex min-h-[52px] items-center justify-center gap-2 rounded-2xl px-5 text-[17px] font-semibold transition-colors disabled:opacity-60 ${
        VARIANTI[variante]
      } ${full ? "w-full" : ""} ${className}`}
    >
      {children}
    </button>
  );
}

/* ---------------------------------- card --------------------------------- */

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`surface rounded-3xl border border-app ${className}`}>{children}</div>;
}

/* -------------------------------- pannello ------------------------------- */

/** Bottom sheet su telefono, finestra centrata su tablet. */
export function Pannello({
  aperto,
  onChiudi,
  titolo,
  sottotitolo,
  children,
  larghezza = "max-w-lg",
}: {
  aperto: boolean;
  onChiudi: () => void;
  titolo?: ReactNode;
  sottotitolo?: ReactNode;
  children: ReactNode;
  larghezza?: string;
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
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        aria-label="Chiudi"
        onClick={onChiudi}
        className="animate-fade absolute inset-0 bg-black/45 backdrop-blur-[2px]"
      />
      <div
        role="dialog"
        aria-modal="true"
        className={`animate-sheet surface relative flex max-h-[92dvh] w-full ${larghezza} flex-col overflow-hidden rounded-t-3xl border border-app sm:rounded-3xl`}
      >
        <div className="flex items-start gap-3 border-b border-app px-5 pb-3 pt-4">
          <div className="min-w-0 flex-1">
            {titolo && <h2 className="truncate text-xl font-bold">{titolo}</h2>}
            {sottotitolo && <p className="mt-0.5 text-sm text-muted">{sottotitolo}</p>}
          </div>
          <button
            onClick={onChiudi}
            aria-label="Chiudi"
            className="surface-2 -mr-1 -mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-xl text-muted"
          >
            ✕
          </button>
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-4 safe-bottom">
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
    errore: "bg-rose-500/12 text-rose-700 dark:text-rose-300 border-rose-500/30",
    info: "bg-amber-500/12 text-amber-800 dark:text-amber-200 border-amber-500/30",
    ok: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
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

export function Pallino({ nome, size = "h-12 w-12 text-base" }: { nome: string; size?: string }) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full font-bold text-white ${size} ${tintaDaNome(nome)}`}
    >
      {iniziali(nome)}
    </span>
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
      <span className="text-5xl">{icona}</span>
      <h3 className="text-lg font-bold">{titolo}</h3>
      {testo && <p className="max-w-sm text-sm text-muted">{testo}</p>}
      {azione}
    </div>
  );
}
