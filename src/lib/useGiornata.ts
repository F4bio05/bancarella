"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { ApiError, api } from "./client";
import {
  cacheGiornata,
  codaSulServer,
  conCoda,
  giornataInCache,
  leggiCoda,
  nuovoClientId,
  osservaCoda,
  osservaRete,
  reteAttiva,
  reteSulServer,
  scriviCoda,
  type CodaMovimento,
} from "./local";
import type { DayState } from "./types";

type Risposta = { state: DayState | null };

/**
 * Stato della giornata in corso.
 *
 * I movimenti vengono applicati subito in locale e messi in una coda su
 * localStorage; la coda viene svuotata verso il server appena possibile.
 * Ogni movimento porta un `clientId`, quindi un rinvio non crea duplicati.
 */
export function useGiornata(userId: number, iniziale: DayState | null) {
  const [server, setServer] = useState<DayState | null>(iniziale);
  const [inCorso, setInCorso] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const [reteInterrotta, setReteInterrotta] = useState(false);
  const flushing = useRef(false);

  const coda = useSyncExternalStore(osservaCoda, leggiCoda, codaSulServer);
  const reteDisponibile = useSyncExternalStore(osservaRete, reteAttiva, reteSulServer);
  const online = reteDisponibile && !reteInterrotta;

  /* Tiene aggiornata la copia locale usata come riserva offline. */
  useEffect(() => {
    cacheGiornata(userId, iniziale);
  }, [userId, iniziale]);

  const aggiornaServer = useCallback(
    (state: DayState | null) => {
      setServer(state);
      cacheGiornata(userId, state);
      setReteInterrotta(false);
    },
    [userId],
  );

  /* ------------------------------ invio coda ----------------------------- */

  const svuotaCoda = useCallback(async () => {
    if (flushing.current) return;
    const iniziali = leggiCoda();
    if (iniziali.length === 0) return;

    flushing.current = true;
    let restanti = [...iniziali];
    try {
      for (const item of iniziali) {
        try {
          const { state } = await api<Risposta>(`/api/days/${item.dayId}/movements`, {
            method: "POST",
            body: {
              personId: item.personId,
              amountCents: item.amountCents,
              note: item.note,
              clientId: item.clientId,
            },
          });
          if (state) aggiornaServer(state);
          restanti = restanti.filter((r) => r.clientId !== item.clientId);
        } catch (err) {
          if (err instanceof ApiError && err.offline) {
            setReteInterrotta(true);
            break; // si riprova alla prossima connessione
          }
          // Errore definitivo (es. giornata chiusa): si scarta e si avvisa.
          restanti = restanti.filter((r) => r.clientId !== item.clientId);
          setErrore(err instanceof Error ? err.message : "Movimento non salvato");
        }
      }
    } finally {
      scriviCoda(restanti);
      flushing.current = false;
    }
  }, [aggiornaServer]);

  /* Riconnessione, ritorno in primo piano e ritentativi periodici. */
  useEffect(() => {
    const riprova = () => void svuotaCoda();
    const visibile = () => {
      if (document.visibilityState === "visible") riprova();
    };
    window.addEventListener("online", riprova);
    document.addEventListener("visibilitychange", visibile);
    riprova();
    const t = setInterval(riprova, 20000);
    return () => {
      window.removeEventListener("online", riprova);
      document.removeEventListener("visibilitychange", visibile);
      clearInterval(t);
    };
  }, [svuotaCoda]);

  /* --------------------------------- azioni ------------------------------ */

  const conGestione = useCallback(async <T>(fn: () => Promise<T>): Promise<T | null> => {
    setInCorso(true);
    setErrore(null);
    try {
      return await fn();
    } catch (err) {
      if (err instanceof ApiError && err.offline) {
        setReteInterrotta(true);
        setErrore("Nessuna connessione: riprova quando torna la rete");
      } else {
        setErrore(err instanceof Error ? err.message : "Operazione non riuscita");
      }
      return null;
    } finally {
      setInCorso(false);
    }
  }, []);

  /** Aggiunge (o sottrae, con importo negativo) un importo a una persona.
   *  Restituisce il clientId del movimento, che identifica la riga anche
   *  prima che il server l'abbia confermata. */
  const registraImporto = useCallback(
    (personId: number, amountCents: number, note?: string | null): string | null => {
      const dayId = server?.day.id;
      if (!dayId) return null;
      const item: CodaMovimento = {
        clientId: nuovoClientId(),
        dayId,
        personId,
        amountCents,
        note: note ?? null,
        createdAt: new Date().toISOString(),
      };
      scriviCoda([...leggiCoda(), item]);
      void svuotaCoda();
      return item.clientId;
    },
    [server?.day.id, svuotaCoda],
  );

  const annullaMovimento = useCallback(
    async (movementId: number, clientId: string | null) => {
      if (movementId < 0) {
        // Ancora in coda: basta rimuoverlo prima dell'invio.
        scriviCoda(leggiCoda().filter((c) => c.clientId !== clientId));
        return;
      }
      const dayId = server?.day.id;
      if (!dayId) return;
      await conGestione(async () => {
        const { state } = await api<Risposta>(`/api/days/${dayId}/movements/${movementId}`, {
          method: "DELETE",
        });
        if (state) aggiornaServer(state);
      });
    },
    [server?.day.id, aggiornaServer, conGestione],
  );

  /** Apre una nuova giornata. Rilancia l'errore: la schermata di avvio offre
   *  azioni diverse a seconda del codice (giornata già aperta, data usata...). */
  const apriGiornata = useCallback(
    async (date: string, label: string, personIds: number[]) => {
      const { state } = await api<Risposta>("/api/days", {
        method: "POST",
        body: { date, label, personIds },
      });
      if (state) aggiornaServer(state);
      return state;
    },
    [aggiornaServer],
  );

  /** Riapre una giornata chiusa e la rende quella corrente. */
  const riapriGiornata = useCallback(
    async (dayId: number) => {
      const { state } = await api<Risposta>(`/api/days/${dayId}/reopen`, { method: "POST" });
      if (state) aggiornaServer(state);
      return state;
    },
    [aggiornaServer],
  );

  const chiudiGiornata = useCallback(async () => {
    const dayId = server?.day.id;
    if (!dayId) return null;
    await svuotaCoda();
    if (leggiCoda().some((c) => c.dayId === dayId)) {
      setErrore("Ci sono movimenti non ancora salvati: riprova con la rete attiva");
      return null;
    }
    return conGestione(async () => {
      const { state } = await api<Risposta>(`/api/days/${dayId}/close`, { method: "POST" });
      aggiornaServer(null);
      return state;
    });
  }, [server?.day.id, aggiornaServer, conGestione, svuotaCoda]);

  const aggiungiPersone = useCallback(
    (personIds: number[]) => {
      const dayId = server?.day.id;
      if (!dayId) return Promise.resolve(null);
      return conGestione(async () => {
        const { state } = await api<Risposta>(`/api/days/${dayId}/participants`, {
          method: "POST",
          body: { personIds },
        });
        if (state) aggiornaServer(state);
        return state;
      });
    },
    [server?.day.id, aggiornaServer, conGestione],
  );

  const nuovaPersona = useCallback(
    (name: string) => {
      const dayId = server?.day.id;
      if (!dayId) return Promise.resolve(null);
      return conGestione(async () => {
        const { state } = await api<Risposta>(`/api/days/${dayId}/participants`, {
          method: "POST",
          body: { name },
        });
        if (state) aggiornaServer(state);
        return state;
      });
    },
    [server?.day.id, aggiornaServer, conGestione],
  );

  const rimuoviPersona = useCallback(
    (personId: number) => {
      const dayId = server?.day.id;
      if (!dayId) return Promise.resolve(null);
      return conGestione(async () => {
        const { state } = await api<Risposta>(
          `/api/days/${dayId}/participants?personId=${personId}`,
          { method: "DELETE" },
        );
        if (state) aggiornaServer(state);
        return state;
      });
    },
    [server?.day.id, aggiornaServer, conGestione],
  );

  const ricarica = useCallback(async () => {
    try {
      const { state } = await api<Risposta>("/api/days/current");
      aggiornaServer(state);
    } catch {
      // Senza rete si continua con l'ultima copia salvata in locale.
      const cache = giornataInCache(userId);
      if (cache) setServer(cache);
      setReteInterrotta(true);
    }
  }, [aggiornaServer, userId]);

  const stato = useMemo(() => conCoda(server, coda), [server, coda]);
  const inAttesa = useMemo(
    () => coda.filter((c) => c.dayId === server?.day.id).length,
    [coda, server?.day.id],
  );

  return {
    stato,
    inAttesa,
    online,
    inCorso,
    errore,
    pulisciErrore: () => setErrore(null),
    registraImporto,
    annullaMovimento,
    apriGiornata,
    riapriGiornata,
    chiudiGiornata,
    aggiungiPersone,
    nuovaPersona,
    rimuoviPersona,
    ricarica,
  };
}
