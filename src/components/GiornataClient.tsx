"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ApiError, api } from "@/lib/client";
import { formatDataLunga, formatEuro, oggiIso } from "@/lib/format";
import { cachePersone, cancellaBozza, leggiBozza, leggiUi, salvaBozza, salvaUi } from "@/lib/local";
import type { DayState, Person } from "@/lib/types";
import { QUERY_AFFIANCATO, useMedia } from "@/lib/useMedia";
import { useGiornata } from "@/lib/useGiornata";
import { Tastierino } from "./Tastierino";
import { Avviso, Bottone, CardPersona, Pallino, Pannello, Vuoto } from "./ui";
import { AzioniGiornata } from "./Nav";

const CAMPO =
  "w-full rounded-2xl border border-app surface px-4 py-3.5 text-[16px] outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/25";

export function GiornataClient({
  userId,
  iniziale,
  personeIniziali,
}: {
  userId: number;
  iniziale: DayState | null;
  personeIniziali: Person[];
}) {
  const g = useGiornata(userId, iniziale);
  const [persone, setPersone] = useState<Person[]>(personeIniziali);

  useEffect(() => {
    cachePersone(userId, personeIniziali);
  }, [userId, personeIniziali]);

  const ricaricaPersone = async () => {
    try {
      const { people } = await api<{ people: Person[] }>("/api/people");
      setPersone(people);
      cachePersone(userId, people);
    } catch {
      /* si continua con l'elenco in cache */
    }
  };

  if (!g.stato) {
    return (
      <AvvioGiornata
        persone={persone}
        onNuovaPersona={ricaricaPersone}
        apri={g.apriGiornata}
        riapri={g.riapriGiornata}
        ricarica={g.ricarica}
      />
    );
  }

  return <GiornataAperta g={g} persone={persone} onNuovaPersona={ricaricaPersone} />;
}

/* ========================= schermata di avvio ============================ */

function AvvioGiornata({
  persone,
  onNuovaPersona,
  apri,
  riapri,
  ricarica,
}: {
  persone: Person[];
  onNuovaPersona: () => Promise<void>;
  apri: (date: string, label: string, personIds: number[]) => Promise<DayState | null>;
  riapri: (dayId: number) => Promise<DayState | null>;
  ricarica: () => Promise<void>;
}) {
  const [data, setData] = useState(oggiIso());
  const [etichetta, setEtichetta] = useState("");
  const [scelte, setScelte] = useState<number[]>([]);
  const [cerca, setCerca] = useState("");
  const [nuovoNome, setNuovoNome] = useState("");
  const [inCorso, setInCorso] = useState(false);
  const [errore, setErrore] = useState<{ msg: string; code?: string; dayId?: number } | null>(null);
  const [pronto, setPronto] = useState(false);

  /* Ripristina la bozza salvata dopo un refresh o una chiusura del browser.
     Va fatto dopo il montaggio: durante il render sul server localStorage non
     esiste e leggerlo nell'inizializzatore romperebbe l'idratazione. */
  useEffect(() => {
    const b = leggiBozza();
    if (b) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setData(b.date || oggiIso());

      setEtichetta(b.label ?? "");

      setScelte(b.personIds ?? []);
    }

    setPronto(true);
  }, []);

  useEffect(() => {
    if (pronto) salvaBozza({ date: data, label: etichetta, personIds: scelte });
  }, [pronto, data, etichetta, scelte]);

  const visibili = useMemo(() => {
    const q = cerca.trim().toLowerCase();
    const attive = persone.filter((p) => !p.archived);
    return q ? attive.filter((p) => p.name.toLowerCase().includes(q)) : attive;
  }, [persone, cerca]);

  const togglePersona = (id: number) =>
    setScelte((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const aggiungiNuova = async () => {
    const nome = nuovoNome.trim();
    if (!nome) return;
    setErrore(null);
    try {
      const { person } = await api<{ person: Person }>("/api/people", {
        method: "POST",
        body: { name: nome },
      });
      setNuovoNome("");
      setCerca("");
      setScelte((s) => (s.includes(person.id) ? s : [...s, person.id]));
      await onNuovaPersona();
    } catch (err) {
      if (err instanceof ApiError && err.code === "nome_duplicato" && err.extra.personId) {
        const id = err.extra.personId as number;
        setScelte((s) => (s.includes(id) ? s : [...s, id]));
        setNuovoNome("");
      } else {
        setErrore({ msg: err instanceof Error ? err.message : "Non riuscito" });
      }
    }
  };

  const conferma = async () => {
    setInCorso(true);
    setErrore(null);
    try {
      await apri(data, etichetta, scelte);
      cancellaBozza();
    } catch (err) {
      if (err instanceof ApiError) {
        setErrore({
          msg: err.message,
          code: err.code,
          dayId: err.extra.dayId as number | undefined,
        });
      } else {
        setErrore({ msg: "Non è stato possibile aprire la giornata" });
      }
    } finally {
      setInCorso(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pt-4 safe-top">
      <header className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Nuova giornata</h1>
          <p className="text-sm text-muted">
            Scegli chi ti ha dato dei vestiti: li troverai nell&apos;elenco durante la vendita.
          </p>
        </div>
        <AzioniGiornata />
      </header>

      {errore && (
        <div className="mb-3 flex flex-col gap-2">
          <Avviso onChiudi={() => setErrore(null)}>{errore.msg}</Avviso>
          {errore.code === "data_duplicata" && errore.dayId && (
            <Bottone
              variante="neutro"
              full
              onClick={async () => {
                await riapri(errore.dayId!);
                cancellaBozza();
              }}
            >
              Riapri la giornata del {data.split("-").reverse().join("/")}
            </Bottone>
          )}
          {errore.code === "giornata_aperta" && (
            <Bottone variante="neutro" full onClick={() => void ricarica()}>
              Vai alla giornata già aperta
            </Bottone>
          )}
        </div>
      )}

      <div className="surface mb-3 flex flex-col gap-3 rounded-3xl border border-app p-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold text-muted">Data</span>
          <input
            type="date"
            className={CAMPO}
            value={data}
            onChange={(e) => setData(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold text-muted">Nome della giornata (opzionale)</span>
          <input
            className={CAMPO}
            value={etichetta}
            onChange={(e) => setEtichetta(e.target.value)}
            placeholder="Es. Mercato di piazza"
          />
        </label>
      </div>

      <div className="surface mb-3 rounded-3xl border border-app p-4">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="font-bold">Persone della giornata</h2>
          <span className="text-sm font-semibold text-brand-600 dark:text-brand-300">
            {scelte.length} selezionate
          </span>
        </div>

        <div className="mb-3 flex gap-2">
          <input
            className={CAMPO}
            value={cerca}
            onChange={(e) => setCerca(e.target.value)}
            placeholder="Cerca…"
            inputMode="search"
          />
        </div>

        {persone.filter((p) => !p.archived).length === 0 ? (
          <Vuoto
            icona="👥"
            titolo="Nessuna persona ancora"
            testo="Aggiungi qui sotto chi ti porta i vestiti da vendere."
          />
        ) : (
          <ul className="mb-3 max-h-[46vh] divide-y divide-[var(--border)] overflow-y-auto overscroll-contain rounded-2xl border border-app">
            {visibili.map((p) => {
              const on = scelte.includes(p.id);
              return (
                <li key={p.id}>
                  <button
                    onClick={() => togglePersona(p.id)}
                    className={`flex w-full items-center gap-3 px-3 py-3 text-left ${
                      on ? "bg-brand-50 dark:bg-brand-900/50" : "surface"
                    }`}
                  >
                    <Pallino nome={p.name} size="h-11 w-11 text-sm" />
                    <span className="min-w-0 flex-1 truncate font-semibold">{p.name}</span>
                    <span
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold ${
                        on
                          ? "border-brand-600 bg-brand-600 text-white"
                          : "border-[var(--border)] text-transparent"
                      }`}
                    >
                      ✓
                    </span>
                  </button>
                </li>
              );
            })}
            {visibili.length === 0 && (
              <li className="px-4 py-6 text-center text-sm text-muted">Nessun risultato</li>
            )}
          </ul>
        )}

        <div className="flex gap-2">
          <input
            className={CAMPO}
            value={nuovoNome}
            onChange={(e) => setNuovoNome(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void aggiungiNuova();
            }}
            placeholder="Nuova persona…"
          />
          <Bottone
            variante="neutro"
            onClick={() => void aggiungiNuova()}
            disabled={!nuovoNome.trim()}
          >
            Aggiungi
          </Bottone>
        </div>
      </div>

      <div className="surface sticky bottom-20 z-30 mb-6 rounded-3xl border border-app p-3 md:bottom-4">
        <Bottone full disabled={inCorso} onClick={() => void conferma()} className="!min-h-[58px]">
          {inCorso
            ? "Apro…"
            : `Apri la giornata${scelte.length ? ` · ${scelte.length} persone` : ""}`}
        </Bottone>
        {scelte.length === 0 && (
          <p className="pt-2 text-center text-xs text-muted">
            Puoi aprirla anche vuota e aggiungere le persone durante la vendita.
          </p>
        )}
      </div>
    </div>
  );
}

/* ========================== giornata in corso ============================ */

type Hook = ReturnType<typeof useGiornata>;

function GiornataAperta({
  g,
  persone,
  onNuovaPersona,
}: {
  g: Hook;
  persone: Person[];
  onNuovaPersona: () => Promise<void>;
}) {
  const router = useRouter();
  const stato = g.stato!;
  /* Tablet in orizzontale (o schermo grande): elenco a sinistra e tastierino
     sempre aperto a destra, invece del pannello che sale dal basso. */
  const affiancato = useMedia(QUERY_AFFIANCATO);
  const [selezionato, setSelezionato] = useState<number | null>(null);
  const [digits, setDigits] = useState("");
  const [ordine, setOrdine] = useState<"nome" | "totale">("nome");
  const [pannelloPersone, setPannelloPersone] = useState(false);
  const [pannelloChiusura, setPannelloChiusura] = useState(false);
  const [chiusuraInCorso, setChiusuraInCorso] = useState(false);
  const [conferma, setConferma] = useState<{
    clientId: string;
    nome: string;
    importo: number;
  } | null>(null);

  /* Ripristina il tastierino aperto e le cifre digitate dopo un refresh.
     Come sopra: sessionStorage e' leggibile solo lato browser. */
  useEffect(() => {
    const ui = leggiUi();
    if (!ui?.personId) return;
    if (stato.participants.some((p) => p.personId === ui.personId)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelezionato(ui.personId);

      setDigits(ui.digits ?? "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    salvaUi({ personId: selezionato, digits });
  }, [selezionato, digits]);

  /* La conferma dell'ultimo importo resta visibile qualche secondo. */
  useEffect(() => {
    if (!conferma) return;
    const t = setTimeout(() => setConferma(null), 5000);
    return () => clearTimeout(t);
  }, [conferma]);

  const partecipanti = useMemo(() => {
    const list = [...stato.participants];
    if (ordine === "totale") list.sort((a, b) => b.totalCents - a.totalCents);
    return list;
  }, [stato.participants, ordine]);

  const persona = partecipanti.find((p) => p.personId === selezionato) ?? null;
  const movimentiPersona = useMemo(
    () => (persona ? stato.movements.filter((m) => m.personId === persona.personId) : []),
    [stato.movements, persona],
  );

  /* Dopo ogni importo la persona viene deselezionata: il tastierino si chiude
     (o torna vuoto nella vista affiancata) e non si rischia di attribuire
     l'articolo successivo allo stesso nome per distrazione. */
  const registra = (cents: number) => {
    if (!persona) return;
    const clientId = g.registraImporto(persona.personId, cents);
    setSelezionato(null);
    setDigits("");
    if (clientId) setConferma({ clientId, nome: persona.name, importo: cents });
  };

  /** Annulla l'ultimo importo registrato, sia in coda che già confermato. */
  const annullaUltimo = () => {
    if (!conferma) return;
    const m = stato.movements.find((x) => x.clientId === conferma.clientId);
    if (m) void g.annullaMovimento(m.id, m.clientId);
    setConferma(null);
  };

  const tastierino = persona ? (
    <Tastierino
      compatto={affiancato}
      persona={persona}
      movimenti={movimentiPersona}
      digits={digits}
      onDigits={setDigits}
      onRegistra={registra}
      onAnnulla={(m) => void g.annullaMovimento(m.id, m.clientId)}
    />
  ) : null;

  const chiudi = async () => {
    setChiusuraInCorso(true);
    const chiusa = await g.chiudiGiornata();
    setChiusuraInCorso(false);
    if (chiusa) {
      setPannelloChiusura(false);
      router.push(`/storico/${chiusa.day.id}`);
    }
  };

  return (
    <div
      className={`mx-auto w-full pt-4 safe-top ${
        affiancato ? "max-w-[1500px] px-6" : "max-w-3xl px-4"
      }`}
    >
      <div
        className={
          affiancato ? "grid grid-cols-[minmax(0,1fr)_390px] items-start gap-6" : undefined
        }
      >
        <div className="min-w-0">
          {/* Riepilogo */}
          <header className="mb-4">
            <div className="mb-2 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-muted">
                  {stato.day.label ? stato.day.label : "Giornata aperta"}
                </p>
                <h1 className="truncate text-xl font-bold">{formatDataLunga(stato.day.date)}</h1>
              </div>
              <AzioniGiornata />
            </div>

            <div className="rounded-3xl bg-brand-600 px-5 py-4 text-white">
              <p className="text-sm font-semibold text-brand-100">Incasso della giornata</p>
              <p className="tabular text-4xl font-bold">{formatEuro(stato.day.totalCents)}</p>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-brand-100">
                <span>
                  {stato.day.itemsCount} {stato.day.itemsCount === 1 ? "articolo" : "articoli"}
                </span>
                <span>
                  {stato.participants.length}{" "}
                  {stato.participants.length === 1 ? "persona" : "persone"}
                </span>
                {g.inAttesa > 0 && <span>⏳ {g.inAttesa} da sincronizzare</span>}
                {!g.online && <span>📴 offline</span>}
              </div>
            </div>
          </header>

          {g.errore && (
            <div className="mb-3">
              <Avviso onChiudi={g.pulisciErrore}>{g.errore}</Avviso>
            </div>
          )}
          {!g.online && (
            <div className="mb-3">
              <Avviso tipo="info">
                Senza rete continui a lavorare: i movimenti restano salvati sul telefono e vengono
                inviati appena torna la connessione.
              </Avviso>
            </div>
          )}

          {/* Elenco persone */}
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-bold">Elenco persone</h2>
            <div className="surface-2 flex rounded-full p-1 text-xs font-semibold">
              {(["nome", "totale"] as const).map((o) => (
                <button
                  key={o}
                  onClick={() => setOrdine(o)}
                  className={`rounded-full px-3 py-1.5 ${
                    ordine === o ? "surface text-brand-600 dark:text-brand-300" : "text-muted"
                  }`}
                >
                  {o === "nome" ? "A-Z" : "Totale"}
                </button>
              ))}
            </div>
          </div>

          {partecipanti.length === 0 ? (
            <div className="surface rounded-3xl border border-app">
              <Vuoto
                icona="🧺"
                titolo="Ancora nessuno in questa giornata"
                testo="Aggiungi le persone che ti hanno dato dei vestiti."
                azione={
                  <Bottone variante="neutro" onClick={() => setPannelloPersone(true)}>
                    Aggiungi persone
                  </Bottone>
                }
              />
            </div>
          ) : (
            <ul className="mb-3 divide-y divide-[var(--border)] overflow-hidden rounded-3xl border border-app">
              {partecipanti.map((p) => (
                <li key={p.personId}>
                  <button
                    onClick={() => {
                      setSelezionato(p.personId);
                      setDigits("");
                    }}
                    className={`flex w-full items-center gap-3 px-4 py-3.5 text-left active:surface-2 ${
                      affiancato && selezionato === p.personId
                        ? "bg-brand-50 dark:bg-brand-900/40"
                        : "surface"
                    }`}
                  >
                    <Pallino nome={p.name} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[17px] font-semibold">{p.name}</span>
                      <span className="block text-xs text-muted">
                        {p.items === 0
                          ? "nessun articolo venduto"
                          : `${p.items} ${p.items === 1 ? "articolo" : "articoli"}`}
                      </span>
                    </span>
                    <span
                      className={`tabular shrink-0 text-xl font-bold ${
                        p.totalCents > 0
                          ? "text-brand-600 dark:text-brand-300"
                          : p.totalCents < 0
                            ? "text-rose-600 dark:text-rose-400"
                            : "text-muted opacity-60"
                      }`}
                    >
                      {formatEuro(p.totalCents)}
                    </span>
                    <span className="shrink-0 text-muted">
                      {affiancato && selezionato === p.personId ? "●" : "›"}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="mb-6 flex flex-col gap-2 sm:flex-row">
            <Bottone variante="neutro" full onClick={() => setPannelloPersone(true)}>
              ＋ Aggiungi persona
            </Bottone>
            <Bottone variante="primario" full onClick={() => setPannelloChiusura(true)}>
              Chiudi la giornata
            </Bottone>
          </div>
        </div>

        {/* Colonna destra: tastierino sempre a portata di pollice */}
        {affiancato && (
          <aside className="surface sticky top-4 max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain rounded-3xl border border-app p-4">
            <div className="mb-3 border-b border-app pb-3">
              {persona ? (
                <CardPersona
                  nome={persona.name}
                  totaleCents={persona.totalCents}
                  articoli={persona.items}
                  azione={
                    <button
                      onClick={() => {
                        setSelezionato(null);
                        setDigits("");
                      }}
                      className="text-xs font-semibold text-muted"
                    >
                      Deseleziona
                    </button>
                  }
                />
              ) : (
                <h2 className="text-lg font-bold">Articolo venduto</h2>
              )}
            </div>
            {tastierino ?? (
              <Vuoto
                icona="👈"
                titolo="Scegli una persona"
                testo="Tocca un nome nell'elenco: il tastierino resta qui, pronto per il prossimo articolo."
              />
            )}
          </aside>
        )}
      </div>

      {/* Conferma dell'ultimo importo, con annullamento a portata di mano */}
      {conferma && (
        <div className="animate-pop pointer-events-none fixed inset-x-0 bottom-24 z-40 flex justify-center px-4 md:bottom-6">
          <div className="pointer-events-auto flex max-w-full items-center gap-3 rounded-2xl bg-[var(--text)] px-4 py-3 text-[var(--bg)] shadow-xl">
            <span
              className={`tabular shrink-0 font-bold ${
                conferma.importo > 0 ? "text-emerald-400" : "text-rose-400"
              }`}
            >
              {formatEuro(conferma.importo, true)}
            </span>
            <span className="min-w-0 flex-1 truncate text-sm">a {conferma.nome}</span>
            <button
              onClick={annullaUltimo}
              className="shrink-0 rounded-xl bg-white/15 px-3 py-1.5 text-xs font-bold"
            >
              Annulla
            </button>
          </div>
        </div>
      )}

      {/* Su telefono e tablet in verticale il tastierino sale dal basso */}
      {!affiancato && (
        <Pannello
          aperto={!!persona}
          onChiudi={() => {
            setSelezionato(null);
            setDigits("");
          }}
          intestazione={
            persona && (
              <CardPersona
                nome={persona.name}
                totaleCents={persona.totalCents}
                articoli={persona.items}
              />
            )
          }
        >
          {tastierino}
        </Pannello>
      )}

      {/* Aggiunta persone */}
      <PannelloPersone
        aperto={pannelloPersone}
        onChiudi={() => setPannelloPersone(false)}
        persone={persone}
        giaDentro={stato.participants.map((p) => p.personId)}
        onAggiungi={async (ids) => {
          await g.aggiungiPersone(ids);
          setPannelloPersone(false);
        }}
        onNuova={async (nome) => {
          await g.nuovaPersona(nome);
          await onNuovaPersona();
        }}
        onRimuovi={async (id) => {
          await g.rimuoviPersona(id);
        }}
        saldi={Object.fromEntries(stato.participants.map((p) => [p.personId, p.totalCents]))}
      />

      {/* Chiusura */}
      <Pannello
        aperto={pannelloChiusura}
        onChiudi={() => setPannelloChiusura(false)}
        titolo="Chiudi la giornata"
        sottotitolo={formatDataLunga(stato.day.date)}
      >
        <div className="flex flex-col gap-3">
          <div className="surface-2 rounded-2xl px-4 py-3">
            <p className="text-sm text-muted">Totale da registrare</p>
            <p className="tabular text-3xl font-bold">{formatEuro(stato.day.totalCents)}</p>
          </div>
          <ul className="divide-y divide-[var(--border)] overflow-hidden rounded-2xl border border-app">
            {[...stato.participants]
              .sort((a, b) => b.totalCents - a.totalCents)
              .map((p) => (
                <li key={p.personId} className="surface flex items-center gap-3 px-4 py-2.5">
                  <span className="min-w-0 flex-1 truncate font-semibold">{p.name}</span>
                  <span className="text-xs text-muted">{p.items} art.</span>
                  <span className="tabular font-bold">{formatEuro(p.totalCents)}</span>
                </li>
              ))}
          </ul>
          {g.inAttesa > 0 && (
            <Avviso tipo="info">
              {g.inAttesa} movimenti non sono ancora arrivati al server: verranno inviati prima
              della chiusura.
            </Avviso>
          )}
          <p className="text-sm text-muted">
            La giornata verrà salvata nello storico. Potrai sempre riaprirla se dimentichi qualcosa.
          </p>
          <Bottone full disabled={chiusuraInCorso} onClick={() => void chiudi()}>
            {chiusuraInCorso ? "Salvo…" : "Chiudi e salva"}
          </Bottone>
          <Bottone variante="fantasma" full onClick={() => setPannelloChiusura(false)}>
            Non ancora
          </Bottone>
        </div>
      </Pannello>
    </div>
  );
}

/* ------------------- pannello aggiunta/rimozione persone ----------------- */

type PropsPersone = {
  persone: Person[];
  giaDentro: number[];
  saldi: Record<number, number>;
  onAggiungi: (ids: number[]) => Promise<void>;
  onNuova: (nome: string) => Promise<void>;
  onRimuovi: (id: number) => Promise<void>;
};

function PannelloPersone({
  aperto,
  onChiudi,
  ...props
}: PropsPersone & { aperto: boolean; onChiudi: () => void }) {
  return (
    <Pannello
      aperto={aperto}
      onChiudi={onChiudi}
      titolo="Persone della giornata"
      sottotitolo="Aggiungi chi ti ha portato dei vestiti"
    >
      {/* Montato solo quando il pannello e' aperto: ricerca e selezioni
          ripartono pulite a ogni apertura, senza effetti di reset. */}
      {aperto && <ContenutoPersone {...props} />}
    </Pannello>
  );
}

function ContenutoPersone({
  persone,
  giaDentro,
  saldi,
  onAggiungi,
  onNuova,
  onRimuovi,
}: PropsPersone) {
  const [scelte, setScelte] = useState<number[]>([]);
  const [cerca, setCerca] = useState("");
  const [nuovoNome, setNuovoNome] = useState("");
  const [inCorso, setInCorso] = useState(false);

  const disponibili = useMemo(() => {
    const q = cerca.trim().toLowerCase();
    return persone
      .filter((p) => !p.archived && !giaDentro.includes(p.id))
      .filter((p) => (q ? p.name.toLowerCase().includes(q) : true));
  }, [persone, giaDentro, cerca]);

  const dentro = useMemo(
    () => persone.filter((p) => giaDentro.includes(p.id)),
    [persone, giaDentro],
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2">
        <input
          className={CAMPO}
          value={nuovoNome}
          onChange={(e) => setNuovoNome(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && nuovoNome.trim()) {
              void onNuova(nuovoNome.trim()).then(() => setNuovoNome(""));
            }
          }}
          placeholder="Nuova persona…"
        />
        <Bottone
          variante="neutro"
          disabled={!nuovoNome.trim()}
          onClick={() => void onNuova(nuovoNome.trim()).then(() => setNuovoNome(""))}
        >
          Crea
        </Bottone>
      </div>

      {disponibili.length > 0 && (
        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
            Da aggiungere
          </p>
          <input
            className={`${CAMPO} mb-2`}
            value={cerca}
            onChange={(e) => setCerca(e.target.value)}
            placeholder="Cerca…"
            inputMode="search"
          />
          <ul className="max-h-[38vh] divide-y divide-[var(--border)] overflow-y-auto overscroll-contain rounded-2xl border border-app">
            {disponibili.map((p) => {
              const on = scelte.includes(p.id);
              return (
                <li key={p.id}>
                  <button
                    onClick={() =>
                      setScelte((s) => (on ? s.filter((x) => x !== p.id) : [...s, p.id]))
                    }
                    className={`flex w-full items-center gap-3 px-3 py-3 text-left ${
                      on ? "bg-brand-50 dark:bg-brand-900/50" : "surface"
                    }`}
                  >
                    <Pallino nome={p.name} size="h-10 w-10 text-sm" />
                    <span className="min-w-0 flex-1 truncate font-semibold">{p.name}</span>
                    <span
                      className={`flex h-7 w-7 items-center justify-center rounded-full border-2 text-sm font-bold ${
                        on
                          ? "border-brand-600 bg-brand-600 text-white"
                          : "border-[var(--border)] text-transparent"
                      }`}
                    >
                      ✓
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <Bottone
            full
            className="mt-2"
            disabled={scelte.length === 0 || inCorso}
            onClick={async () => {
              setInCorso(true);
              await onAggiungi(scelte);
              setInCorso(false);
            }}
          >
            Aggiungi {scelte.length > 0 ? `${scelte.length} ` : ""}alla giornata
          </Bottone>
        </div>
      )}

      {dentro.length > 0 && (
        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
            Già nella giornata
          </p>
          <ul className="divide-y divide-[var(--border)] overflow-hidden rounded-2xl border border-app">
            {dentro.map((p) => (
              <li key={p.id} className="surface flex items-center gap-3 px-3 py-2.5">
                <Pallino nome={p.name} size="h-10 w-10 text-sm" />
                <span className="min-w-0 flex-1 truncate font-semibold">{p.name}</span>
                {(saldi[p.id] ?? 0) === 0 ? (
                  <button
                    onClick={() => void onRimuovi(p.id)}
                    className="surface-2 rounded-lg px-3 py-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400"
                  >
                    Togli
                  </button>
                ) : (
                  <span className="tabular text-sm font-bold">{formatEuro(saldi[p.id] ?? 0)}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
