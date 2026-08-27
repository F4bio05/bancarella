"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ApiError, api } from "@/lib/client";
import { formatEuro } from "@/lib/format";
import type { Person } from "@/lib/types";
import { Avviso, Bottone, Pallino, Pannello, Vuoto } from "./ui";
import { AzioniIntestazione } from "./Nav";

const CAMPO =
  "w-full rounded-2xl border border-app surface px-4 py-3.5 text-[16px] outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/25";

type Totale = { personId: number; name: string; totalCents: number; days: number; items: number };

export function PersoneClient({
  personeIniziali,
  totali,
}: {
  personeIniziali: Person[];
  totali: Totale[];
}) {
  const router = useRouter();
  const [persone, setPersone] = useState(personeIniziali);
  const [mostraArchiviate, setMostraArchiviate] = useState(false);
  const [cerca, setCerca] = useState("");
  const [nuova, setNuova] = useState(false);
  const [inModifica, setInModifica] = useState<Person | null>(null);
  const [errore, setErrore] = useState<string | null>(null);

  const mappaTotali = useMemo(() => new Map(totali.map((t) => [t.personId, t])), [totali]);

  const visibili = useMemo(() => {
    const q = cerca.trim().toLowerCase();
    return persone
      .filter((p) => (mostraArchiviate ? true : !p.archived))
      .filter((p) => (q ? p.name.toLowerCase().includes(q) : true));
  }, [persone, mostraArchiviate, cerca]);

  const aggiorna = (p: Person) =>
    setPersone((list) => {
      const esiste = list.some((x) => x.id === p.id);
      const next = esiste ? list.map((x) => (x.id === p.id ? p : x)) : [...list, p];
      return next.sort((a, b) =>
        a.archived === b.archived ? a.name.localeCompare(b.name, "it") : a.archived ? 1 : -1,
      );
    });

  const nArchiviate = persone.filter((p) => p.archived).length;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pt-4 safe-top">
      <header className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Persone</h1>
          <p className="text-sm text-muted">Chi ti dà i vestiti da vendere.</p>
        </div>
        <AzioniIntestazione />
      </header>

      {errore && (
        <div className="mb-3">
          <Avviso onChiudi={() => setErrore(null)}>{errore}</Avviso>
        </div>
      )}

      <div className="mb-3 flex gap-2">
        <input
          className={CAMPO}
          value={cerca}
          onChange={(e) => setCerca(e.target.value)}
          placeholder="Cerca…"
          inputMode="search"
        />
        <Bottone onClick={() => setNuova(true)}>＋</Bottone>
      </div>

      {visibili.length === 0 ? (
        <div className="surface rounded-3xl border border-app">
          <Vuoto
            icona="👥"
            titolo={cerca ? "Nessun risultato" : "Nessuna persona"}
            testo={cerca ? undefined : "Aggiungi chi ti porta i vestiti da vendere."}
            azione={
              cerca ? undefined : (
                <Bottone variante="neutro" onClick={() => setNuova(true)}>
                  Aggiungi la prima
                </Bottone>
              )
            }
          />
        </div>
      ) : (
        <ul className="mb-3 divide-y divide-[var(--border)] overflow-hidden rounded-3xl border border-app">
          {visibili.map((p) => {
            const t = mappaTotali.get(p.id);
            return (
              <li key={p.id}>
                <button
                  onClick={() => setInModifica(p)}
                  className={`surface flex w-full items-center gap-3 px-4 py-3.5 text-left active:surface-2 ${
                    p.archived ? "opacity-55" : ""
                  }`}
                >
                  <Pallino nome={p.name} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-[17px] font-semibold">{p.name}</span>
                      {p.archived && (
                        <span className="surface-2 shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold text-muted">
                          archiviata
                        </span>
                      )}
                    </span>
                    <span className="block text-xs text-muted">
                      {t
                        ? `${t.days} ${t.days === 1 ? "giornata" : "giornate"} · ${t.items} articoli`
                        : "nessuna vendita"}
                    </span>
                  </span>
                  <span className="tabular shrink-0 text-lg font-bold text-brand-600 dark:text-brand-300">
                    {formatEuro(t?.totalCents ?? 0)}
                  </span>
                  <span className="shrink-0 text-muted">›</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {nArchiviate > 0 && (
        <button
          onClick={() => setMostraArchiviate((v) => !v)}
          className="mb-8 w-full rounded-2xl px-4 py-3 text-sm font-semibold text-muted active:surface-2"
        >
          {mostraArchiviate
            ? "Nascondi le archiviate"
            : `Mostra ${nArchiviate} ${nArchiviate === 1 ? "persona archiviata" : "persone archiviate"}`}
        </button>
      )}

      <PannelloPersona
        aperto={nuova}
        onChiudi={() => setNuova(false)}
        onSalvata={(p) => {
          aggiorna(p);
          setNuova(false);
          router.refresh();
        }}
        onErrore={setErrore}
      />

      <PannelloPersona
        aperto={!!inModifica}
        persona={inModifica ?? undefined}
        onChiudi={() => setInModifica(null)}
        onSalvata={(p) => {
          aggiorna(p);
          setInModifica(null);
          router.refresh();
        }}
        onEliminata={(id) => {
          setPersone((l) => l.filter((x) => x.id !== id));
          setInModifica(null);
          router.refresh();
        }}
        onErrore={setErrore}
      />
    </div>
  );
}

type PropsForm = {
  persona?: Person;
  onChiudi: () => void;
  onSalvata: (p: Person) => void;
  onEliminata?: (id: number) => void;
  onErrore: (m: string) => void;
};

function PannelloPersona({ aperto, ...props }: PropsForm & { aperto: boolean }) {
  return (
    <Pannello
      aperto={aperto}
      onChiudi={props.onChiudi}
      titolo={props.persona ? "Modifica persona" : "Nuova persona"}
    >
      {/* Il form si monta a ogni apertura (e cambia identita' al cambio di
          persona), quindi i campi partono sempre dai valori giusti. */}
      {aperto && <FormPersona key={props.persona?.id ?? "nuova"} {...props} />}
    </Pannello>
  );
}

function FormPersona({ persona, onSalvata, onEliminata, onErrore }: PropsForm) {
  const modifica = !!persona;
  const [nome, setNome] = useState(persona?.name ?? "");
  const [telefono, setTelefono] = useState(persona?.phone ?? "");
  const [nota, setNota] = useState(persona?.note ?? "");
  const [inCorso, setInCorso] = useState(false);
  const [confermaElimina, setConfermaElimina] = useState(false);

  const salva = async () => {
    setInCorso(true);
    try {
      const body = { name: nome, phone: telefono, note: nota };
      const { person } = modifica
        ? await api<{ person: Person }>(`/api/people/${persona!.id}`, { method: "PATCH", body })
        : await api<{ person: Person }>("/api/people", { method: "POST", body });
      onSalvata(person);
    } catch (err) {
      onErrore(err instanceof ApiError ? err.message : "Salvataggio non riuscito");
    } finally {
      setInCorso(false);
    }
  };

  const archivia = async (archived: boolean) => {
    setInCorso(true);
    try {
      const { person } = await api<{ person: Person }>(`/api/people/${persona!.id}`, {
        method: "PATCH",
        body: { archived },
      });
      onSalvata(person);
    } catch (err) {
      onErrore(err instanceof ApiError ? err.message : "Operazione non riuscita");
    } finally {
      setInCorso(false);
    }
  };

  const elimina = async () => {
    setInCorso(true);
    try {
      await api(`/api/people/${persona!.id}`, { method: "DELETE" });
      onEliminata?.(persona!.id);
    } catch (err) {
      onErrore(err instanceof ApiError ? err.message : "Eliminazione non riuscita");
    } finally {
      setInCorso(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold text-muted">Nome</span>
        <input
          className={CAMPO}
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Es. Maria Rossi"
          autoFocus={!modifica}
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold text-muted">Telefono (opzionale)</span>
        <input
          className={CAMPO}
          value={telefono}
          onChange={(e) => setTelefono(e.target.value)}
          inputMode="tel"
          placeholder="+39 …"
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold text-muted">Nota (opzionale)</span>
        <textarea
          className={`${CAMPO} min-h-[80px]`}
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          placeholder="Es. paga a fine mese, 3 borse consegnate…"
        />
      </label>

      <Bottone full disabled={inCorso || !nome.trim()} onClick={() => void salva()}>
        {inCorso ? "Salvo…" : "Salva"}
      </Bottone>

      {modifica && (
        <div className="mt-2 flex flex-col gap-2 border-t border-app pt-3">
          <Bottone
            variante="neutro"
            full
            disabled={inCorso}
            onClick={() => void archivia(!persona!.archived)}
          >
            {persona!.archived
              ? "Rimetti tra le attive"
              : "Archivia (non compare più negli elenchi)"}
          </Bottone>
          {confermaElimina ? (
            <div className="flex flex-col gap-2">
              <Avviso tipo="errore">
                Se ha già delle vendite registrate verrà solo archiviata, per non perdere lo
                storico. Confermi?
              </Avviso>
              <div className="flex gap-2">
                <Bottone variante="neutro" full onClick={() => setConfermaElimina(false)}>
                  No
                </Bottone>
                <Bottone variante="pericolo" full disabled={inCorso} onClick={() => void elimina()}>
                  Sì, elimina
                </Bottone>
              </div>
            </div>
          ) : (
            <Bottone variante="fantasma" full onClick={() => setConfermaElimina(true)}>
              Elimina persona
            </Bottone>
          )}
        </div>
      )}
    </div>
  );
}
