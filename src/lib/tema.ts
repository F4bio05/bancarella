/**
 * Tema dell'interfaccia. Il valore vive in un cookie leggibile dal server,
 * cosi' il primo HTML arriva già col tema giusto (nessun lampo bianco/nero).
 * Il default è il tema chiaro.
 */

export type Tema = "chiaro" | "scuro" | "sistema";

export const COOKIE_TEMA = "bancarella_tema";
export const TEMA_DEFAULT: Tema = "chiaro";
export const TEMI: Tema[] = ["chiaro", "scuro", "sistema"];

export const ETICHETTE: Record<Tema, { icona: string; nome: string }> = {
  chiaro: { icona: "☀️", nome: "Chiaro" },
  scuro: { icona: "🌙", nome: "Scuro" },
  sistema: { icona: "📱", nome: "Come il telefono" },
};

/** Normalizza un valore arbitrario (cookie, attributo) in un tema valido. */
export function temaValido(valore: string | null | undefined): Tema {
  return valore === "scuro" || valore === "sistema" || valore === "chiaro"
    ? valore
    : TEMA_DEFAULT;
}

/* ------------------------- lato browser (store) ------------------------- */

const ascoltatori = new Set<() => void>();

export function temaCorrente(): Tema {
  if (typeof document === "undefined") return TEMA_DEFAULT;
  return temaValido(document.documentElement.dataset.tema);
}

export const temaSulServer = (): Tema => TEMA_DEFAULT;

export function osservaTema(cb: () => void): () => void {
  ascoltatori.add(cb);
  return () => ascoltatori.delete(cb);
}

export function impostaTema(tema: Tema): void {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.tema = tema;
  const exp = new Date(Date.now() + 365 * 864e5).toUTCString();
  document.cookie = `${COOKIE_TEMA}=${tema}; expires=${exp}; path=/; samesite=lax`;
  for (const cb of ascoltatori) cb();
}

/** Passa al tema successivo del ciclo chiaro → scuro → sistema. */
export function temaSuccessivo(attuale: Tema): Tema {
  return TEMI[(TEMI.indexOf(attuale) + 1) % TEMI.length];
}
