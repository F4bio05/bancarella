"use client";

import type { DayState, Movement, Person } from "./types";

/**
 * Persistenza lato browser.
 *
 * - localStorage : ultimo stato conosciuto della giornata + coda offline + anagrafica.
 *                  Sopravvive alla chiusura del browser.
 * - sessionStorage : stato dell'interfaccia (tastierino aperto, cifre digitate).
 *                  Sopravvive al refresh della scheda.
 * - cookie : id dell'ultima giornata usata e importi rapidi, come rete di sicurezza
 *            se localStorage viene svuotato.
 */

const K = {
  day: "bancarella.day.v2",
  queue: "bancarella.queue.v2",
  people: "bancarella.people.v2",
  draft: "bancarella.draftGiornata.v2",
  ui: "bancarella.ui.v2",
} as const;

const COOKIE_DAY = "bancarella_ultima_giornata";
const COOKIE_QUICK = "bancarella_importi_rapidi";

const hasWindow = () => typeof window !== "undefined";

function readJson<T>(store: Storage | null, key: string): T | null {
  if (!store) return null;
  try {
    const raw = store.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeJson(store: Storage | null, key: string, value: unknown): void {
  if (!store) return;
  try {
    store.setItem(key, JSON.stringify(value));
  } catch {
    /* quota piena o storage negato: si continua senza cache */
  }
}

function local(): Storage | null {
  if (!hasWindow()) return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function session(): Storage | null {
  if (!hasWindow()) return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

/* --------------------------------- cookie -------------------------------- */

export function setCookie(name: string, value: string, days = 365): void {
  if (!hasWindow()) return;
  const exp = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${exp}; path=/; samesite=lax`;
}

export function getCookie(name: string): string | null {
  if (!hasWindow()) return null;
  const hit = document.cookie.split("; ").find((c) => c.startsWith(`${name}=`));
  return hit ? decodeURIComponent(hit.slice(name.length + 1)) : null;
}

export function ricordaGiornata(dayId: number | null): void {
  setCookie(COOKIE_DAY, dayId == null ? "" : String(dayId));
}

export function giornataRicordata(): number | null {
  const raw = getCookie(COOKIE_DAY);
  const n = raw ? Number(raw) : NaN;
  return Number.isInteger(n) && n > 0 ? n : null;
}

const QUICK_DEFAULT = [100, 200, 300, 500, 1000, 2000];
const ascoltatoriRapidi = new Set<() => void>();
let cacheRapidi: number[] = QUICK_DEFAULT;
let cacheRapidiRaw: string | null | undefined;

/** Importi rapidi personalizzati, tenuti in un cookie. */
export function importiRapidi(): number[] {
  const raw = getCookie(COOKIE_QUICK);
  if (raw !== cacheRapidiRaw) {
    cacheRapidiRaw = raw;
    const list = (raw ?? "")
      .split(",")
      .map((n) => Number(n))
      .filter((n) => Number.isInteger(n) && n > 0 && n <= 100000);
    cacheRapidi = list.length === 6 ? list : QUICK_DEFAULT;
  }
  return cacheRapidi;
}

export function salvaImportiRapidi(list: number[]): void {
  setCookie(COOKIE_QUICK, list.join(","));
  for (const cb of ascoltatoriRapidi) cb();
}

export function osservaImportiRapidi(cb: () => void): () => void {
  ascoltatoriRapidi.add(cb);
  return () => ascoltatoriRapidi.delete(cb);
}

export const importiRapidiSulServer = (): number[] => QUICK_DEFAULT;

/* ------------------------- cache stato / anagrafica ---------------------- */

type CachedDay = { userId: number; state: DayState | null; savedAt: string };

export function cacheGiornata(userId: number, state: DayState | null): void {
  writeJson(local(), K.day, { userId, state, savedAt: new Date().toISOString() } as CachedDay);
  ricordaGiornata(state?.day.id ?? null);
}

export function giornataInCache(userId: number): DayState | null {
  const c = readJson<CachedDay>(local(), K.day);
  return c && c.userId === userId ? c.state : null;
}

export function cachePersone(userId: number, people: Person[]): void {
  writeJson(local(), K.people, { userId, people });
}

export function personeInCache(userId: number): Person[] | null {
  const c = readJson<{ userId: number; people: Person[] }>(local(), K.people);
  return c && c.userId === userId ? c.people : null;
}

export function svuotaCacheUtente(): void {
  const s = local();
  if (!s) return;
  for (const key of Object.values(K)) {
    try {
      s.removeItem(key);
    } catch {
      /* ignore */
    }
  }
  const ss = session();
  if (ss) {
    try {
      ss.removeItem(K.ui);
    } catch {
      /* ignore */
    }
  }
  ricordaGiornata(null);
}

/* ---------------------------- bozza nuova giornata ---------------------- */

export type BozzaGiornata = { date: string; label: string; personIds: number[] };

export function salvaBozza(b: BozzaGiornata): void {
  writeJson(local(), K.draft, b);
}
export function leggiBozza(): BozzaGiornata | null {
  return readJson<BozzaGiornata>(local(), K.draft);
}
export function cancellaBozza(): void {
  local()?.removeItem(K.draft);
}

/* ------------------------------ stato interfaccia ----------------------- */

export type UiState = { personId: number | null; digits: string };

export function salvaUi(ui: UiState): void {
  writeJson(session(), K.ui, ui);
}
export function leggiUi(): UiState | null {
  return readJson<UiState>(session(), K.ui);
}

/* -------------------------------- coda offline -------------------------- */

export type CodaMovimento = {
  clientId: string;
  dayId: number;
  personId: number;
  amountCents: number;
  note: string | null;
  createdAt: string;
};

const CODA_VUOTA: CodaMovimento[] = [];
const ascoltatori = new Set<() => void>();
let cacheCoda: CodaMovimento[] = CODA_VUOTA;
let cacheRaw: string | null = null;

export function leggiCoda(): CodaMovimento[] {
  const raw = local()?.getItem(K.queue) ?? null;
  if (raw !== cacheRaw) {
    cacheRaw = raw;
    try {
      const parsed = raw ? (JSON.parse(raw) as CodaMovimento[]) : CODA_VUOTA;
      cacheCoda = Array.isArray(parsed) ? parsed : CODA_VUOTA;
    } catch {
      cacheCoda = CODA_VUOTA;
    }
  }
  return cacheCoda;
}

export function scriviCoda(items: CodaMovimento[]): void {
  writeJson(local(), K.queue, items);
  for (const cb of ascoltatori) cb();
}

/* La coda e' uno stato esterno a React: la si osserva con useSyncExternalStore,
   cosi' anche una seconda scheda aperta resta allineata. */

export function osservaCoda(cb: () => void): () => void {
  ascoltatori.add(cb);
  const daAltraScheda = (e: StorageEvent) => {
    if (e.key === null || e.key === K.queue) cb();
  };
  window.addEventListener("storage", daAltraScheda);
  return () => {
    ascoltatori.delete(cb);
    window.removeEventListener("storage", daAltraScheda);
  };
}

export const codaSulServer = (): CodaMovimento[] => CODA_VUOTA;

/* Stato della connessione, anch'esso esterno a React. */

export function osservaRete(cb: () => void): () => void {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
}

export const reteAttiva = (): boolean =>
  typeof navigator === "undefined" ? true : navigator.onLine;
export const reteSulServer = (): boolean => true;

export function nuovoClientId(): string {
  if (hasWindow() && window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `m-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Sovrappone allo stato del server i movimenti ancora in coda,
 * cosi' l'interfaccia mostra subito i totali giusti anche senza rete.
 */
export function conCoda(state: DayState | null, coda: CodaMovimento[]): DayState | null {
  if (!state) return null;
  const mine = coda.filter((c) => c.dayId === state.day.id);
  if (mine.length === 0) return state;

  const confermati = new Set(state.movements.map((m) => m.clientId).filter(Boolean) as string[]);
  const daApplicare = mine.filter((c) => !confermati.has(c.clientId));
  if (daApplicare.length === 0) return state;

  const extra: Movement[] = daApplicare.map((c, i) => ({
    id: -(i + 1),
    personId: c.personId,
    amountCents: c.amountCents,
    note: c.note,
    clientId: c.clientId,
    createdAt: c.createdAt,
  }));

  const perPersona = new Map<number, { total: number; items: number }>();
  for (const c of daApplicare) {
    const cur = perPersona.get(c.personId) ?? { total: 0, items: 0 };
    cur.total += c.amountCents;
    if (c.amountCents > 0) cur.items += 1;
    perPersona.set(c.personId, cur);
  }

  const participants = state.participants.map((p) => {
    const add = perPersona.get(p.personId);
    return add ? { ...p, totalCents: p.totalCents + add.total, items: p.items + add.items } : p;
  });

  const deltaTotale = daApplicare.reduce((s, c) => s + c.amountCents, 0);
  const deltaPezzi = daApplicare.filter((c) => c.amountCents > 0).length;

  return {
    day: {
      ...state.day,
      totalCents: state.day.totalCents + deltaTotale,
      itemsCount: state.day.itemsCount + deltaPezzi,
    },
    participants,
    movements: [...extra, ...state.movements],
  };
}
