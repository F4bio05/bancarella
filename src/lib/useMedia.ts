"use client";

import { useMemo, useSyncExternalStore } from "react";

/**
 * Osserva una media query. Sul server risponde sempre `false`, quindi il
 * markup iniziale è quello per telefono e viene corretto all'idratazione.
 */
export function useMedia(query: string): boolean {
  const [osserva, leggi] = useMemo(() => {
    const mql = typeof window === "undefined" ? null : window.matchMedia(query);
    return [
      (cb: () => void) => {
        mql?.addEventListener("change", cb);
        return () => mql?.removeEventListener("change", cb);
      },
      () => mql?.matches ?? false,
    ] as const;
  }, [query]);

  return useSyncExternalStore(osserva, leggi, () => false);
}

/** Tablet (o schermo grande) in orizzontale: c'è spazio per elenco + tastierino. */
export const QUERY_AFFIANCATO = "(min-width: 1024px) and (orientation: landscape)";
