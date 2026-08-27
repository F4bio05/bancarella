import { getDb, nowIso, tx } from "./db";
import type { DayState, DaySummary, Movement, Participant, Person } from "./types";

export class StoreError extends Error {
  code: string;
  status: number;
  extra?: Record<string, unknown>;
  constructor(code: string, message: string, status = 400, extra?: Record<string, unknown>) {
    super(message);
    this.code = code;
    this.status = status;
    this.extra = extra;
  }
}

type Row = Record<string, unknown>;
const num = (v: unknown) => Number(v ?? 0);
const str = (v: unknown) => (v == null ? null : String(v));

/* -------------------------------- persone -------------------------------- */

function mapPerson(r: Row): Person {
  return {
    id: num(r.id),
    name: String(r.name),
    phone: str(r.phone),
    note: str(r.note),
    archived: num(r.archived) === 1,
  };
}

export function listPeople(userId: number, includeArchived = false): Person[] {
  const rows = getDb()
    .prepare(
      `SELECT * FROM people
        WHERE user_id = ? ${includeArchived ? "" : "AND archived = 0"}
        ORDER BY archived ASC, name COLLATE NOCASE ASC`,
    )
    .all(userId) as Row[];
  return rows.map(mapPerson);
}

export function createPerson(
  userId: number,
  name: string,
  phone?: string | null,
  note?: string | null,
): Person {
  const clean = name.trim().replace(/\s+/g, " ");
  if (clean.length < 1) throw new StoreError("nome_vuoto", "Il nome non può essere vuoto");
  if (clean.length > 60) throw new StoreError("nome_lungo", "Nome troppo lungo (max 60 caratteri)");

  const existing = getDb()
    .prepare("SELECT * FROM people WHERE user_id = ? AND name_lower = ?")
    .get(userId, clean.toLowerCase()) as Row | undefined;

  if (existing) {
    if (num(existing.archived) === 1) {
      getDb().prepare("UPDATE people SET archived = 0 WHERE id = ?").run(num(existing.id));
      return { ...mapPerson(existing), archived: false };
    }
    throw new StoreError("nome_duplicato", `"${clean}" è già nell'elenco`, 409, {
      personId: num(existing.id),
    });
  }

  const info = getDb()
    .prepare(
      `INSERT INTO people (user_id, name, name_lower, phone, note, archived, created_at)
       VALUES (?, ?, ?, ?, ?, 0, ?)`,
    )
    .run(userId, clean, clean.toLowerCase(), phone?.trim() || null, note?.trim() || null, nowIso());

  return {
    id: Number(info.lastInsertRowid),
    name: clean,
    phone: phone?.trim() || null,
    note: note?.trim() || null,
    archived: false,
  };
}

export function updatePerson(
  userId: number,
  personId: number,
  patch: { name?: string; phone?: string | null; note?: string | null; archived?: boolean },
): Person {
  const row = getDb()
    .prepare("SELECT * FROM people WHERE id = ? AND user_id = ?")
    .get(personId, userId) as Row | undefined;
  if (!row) throw new StoreError("non_trovato", "Persona non trovata", 404);

  const current = mapPerson(row);
  const name = patch.name !== undefined ? patch.name.trim().replace(/\s+/g, " ") : current.name;
  if (!name) throw new StoreError("nome_vuoto", "Il nome non può essere vuoto");

  if (name.toLowerCase() !== current.name.toLowerCase()) {
    const clash = getDb()
      .prepare("SELECT id FROM people WHERE user_id = ? AND name_lower = ? AND id <> ?")
      .get(userId, name.toLowerCase(), personId) as Row | undefined;
    if (clash) throw new StoreError("nome_duplicato", `"${name}" è già nell'elenco`, 409);
  }

  const phone = patch.phone !== undefined ? patch.phone?.trim() || null : current.phone;
  const note = patch.note !== undefined ? patch.note?.trim() || null : current.note;
  const archived = patch.archived !== undefined ? patch.archived : current.archived;

  getDb()
    .prepare(
      `UPDATE people SET name = ?, name_lower = ?, phone = ?, note = ?, archived = ?
        WHERE id = ? AND user_id = ?`,
    )
    .run(name, name.toLowerCase(), phone, note, archived ? 1 : 0, personId, userId);

  return { id: personId, name, phone, note, archived };
}

export function deletePerson(userId: number, personId: number): void {
  const used = getDb()
    .prepare("SELECT COUNT(*) AS n FROM day_participants WHERE person_id = ?")
    .get(personId) as Row;
  if (num(used.n) > 0) {
    // Ha uno storico: si archivia invece di cancellare, per non perdere i totali passati.
    updatePerson(userId, personId, { archived: true });
    return;
  }
  const info = getDb()
    .prepare("DELETE FROM people WHERE id = ? AND user_id = ?")
    .run(personId, userId);
  if (Number(info.changes) === 0) throw new StoreError("non_trovato", "Persona non trovata", 404);
}

/* -------------------------------- giornate ------------------------------- */

function mapDay(r: Row): DaySummary {
  return {
    id: num(r.id),
    date: String(r.day_date),
    label: str(r.label),
    status: String(r.status) === "closed" ? "closed" : "open",
    openedAt: String(r.opened_at),
    closedAt: str(r.closed_at),
    totalCents: num(r.total_cents),
    peopleCount: num(r.people_count),
    itemsCount: num(r.items_count),
  };
}

const DAY_SELECT = `
  SELECT d.*,
         (SELECT COUNT(*) FROM day_participants p WHERE p.day_id = d.id)              AS people_count,
         (SELECT COUNT(*) FROM movements m WHERE m.day_id = d.id AND m.amount_cents > 0) AS items_count,
         COALESCE((SELECT SUM(m.amount_cents) FROM movements m WHERE m.day_id = d.id), 0) AS live_total
    FROM days d`;

function readDay(userId: number, dayId: number): Row {
  const row = getDb()
    .prepare(`${DAY_SELECT} WHERE d.id = ? AND d.user_id = ?`)
    .get(dayId, userId) as Row | undefined;
  if (!row) throw new StoreError("non_trovato", "Giornata non trovata", 404);
  // Per le giornate aperte il totale e' sempre ricalcolato dai movimenti.
  if (String(row.status) === "open") row.total_cents = row.live_total;
  return row;
}

export function getOpenDay(userId: number): DaySummary | null {
  const row = getDb()
    .prepare(`${DAY_SELECT} WHERE d.user_id = ? AND d.status = 'open' ORDER BY d.id DESC LIMIT 1`)
    .get(userId) as Row | undefined;
  if (!row) return null;
  row.total_cents = row.live_total;
  return mapDay(row);
}

export function listDays(userId: number, limit = 200): DaySummary[] {
  const rows = getDb()
    .prepare(`${DAY_SELECT} WHERE d.user_id = ? ORDER BY d.day_date DESC, d.id DESC LIMIT ?`)
    .all(userId, limit) as Row[];
  return rows.map((r) => {
    if (String(r.status) === "open") r.total_cents = r.live_total;
    return mapDay(r);
  });
}

export function openDay(
  userId: number,
  opts: { date: string; label?: string | null; personIds?: number[] },
): DayState {
  const open = getOpenDay(userId);
  if (open) {
    throw new StoreError("giornata_aperta", "C'è già una giornata aperta", 409, { dayId: open.id });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(opts.date)) {
    throw new StoreError("data_invalida", "Data non valida");
  }

  const same = getDb()
    .prepare("SELECT id FROM days WHERE user_id = ? AND day_date = ? ORDER BY id DESC LIMIT 1")
    .get(userId, opts.date) as Row | undefined;
  if (same) {
    throw new StoreError("data_duplicata", "Esiste già una giornata per questa data", 409, {
      dayId: num(same.id),
    });
  }

  return tx(() => {
    const info = getDb()
      .prepare(
        `INSERT INTO days (user_id, day_date, label, status, opened_at, total_cents)
         VALUES (?, ?, ?, 'open', ?, 0)`,
      )
      .run(userId, opts.date, opts.label?.trim() || null, nowIso());
    const dayId = Number(info.lastInsertRowid);
    for (const pid of opts.personIds ?? []) addParticipantRaw(userId, dayId, pid);
    return getDayState(userId, dayId);
  });
}

export function closeDay(userId: number, dayId: number): DayState {
  const row = readDay(userId, dayId);
  if (String(row.status) === "closed") return getDayState(userId, dayId);
  getDb()
    .prepare("UPDATE days SET status = 'closed', closed_at = ?, total_cents = ? WHERE id = ?")
    .run(nowIso(), num(row.live_total), dayId);
  return getDayState(userId, dayId);
}

export function reopenDay(userId: number, dayId: number): DayState {
  const open = getOpenDay(userId);
  if (open && open.id !== dayId) {
    throw new StoreError("giornata_aperta", "Chiudi prima la giornata aperta", 409, {
      dayId: open.id,
    });
  }
  readDay(userId, dayId);
  getDb().prepare("UPDATE days SET status = 'open', closed_at = NULL WHERE id = ?").run(dayId);
  return getDayState(userId, dayId);
}

export function deleteDay(userId: number, dayId: number): void {
  readDay(userId, dayId);
  getDb().prepare("DELETE FROM days WHERE id = ? AND user_id = ?").run(dayId, userId);
}

export function updateDay(
  userId: number,
  dayId: number,
  patch: { label?: string | null; date?: string },
): DayState {
  const row = readDay(userId, dayId);
  const label = patch.label !== undefined ? patch.label?.trim() || null : str(row.label);
  const date = patch.date ?? String(row.day_date);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new StoreError("data_invalida", "Data non valida");
  getDb().prepare("UPDATE days SET label = ?, day_date = ? WHERE id = ?").run(label, date, dayId);
  return getDayState(userId, dayId);
}

/* ------------------------------ partecipanti ----------------------------- */

function addParticipantRaw(userId: number, dayId: number, personId: number): void {
  const person = getDb()
    .prepare("SELECT id, name FROM people WHERE id = ? AND user_id = ?")
    .get(personId, userId) as Row | undefined;
  if (!person) throw new StoreError("non_trovato", "Persona non trovata", 404);
  getDb()
    .prepare(
      `INSERT INTO day_participants (day_id, person_id, person_name, added_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(day_id, person_id) DO NOTHING`,
    )
    .run(dayId, personId, String(person.name), nowIso());
}

export function addParticipants(userId: number, dayId: number, personIds: number[]): DayState {
  const row = readDay(userId, dayId);
  if (String(row.status) === "closed") {
    throw new StoreError("giornata_chiusa", "La giornata è chiusa", 409);
  }
  return tx(() => {
    for (const pid of personIds) addParticipantRaw(userId, dayId, pid);
    return getDayState(userId, dayId);
  });
}

/** Aggiunge una persona nuova all'anagrafica e alla giornata in un colpo solo. */
export function createAndAddPerson(userId: number, dayId: number, name: string): DayState {
  const row = readDay(userId, dayId);
  if (String(row.status) === "closed") {
    throw new StoreError("giornata_chiusa", "La giornata è chiusa", 409);
  }
  return tx(() => {
    let person: Person;
    try {
      person = createPerson(userId, name);
    } catch (err) {
      if (err instanceof StoreError && err.code === "nome_duplicato" && err.extra?.personId) {
        person = {
          id: err.extra.personId as number,
          name,
          phone: null,
          note: null,
          archived: false,
        };
      } else throw err;
    }
    addParticipantRaw(userId, dayId, person.id);
    return getDayState(userId, dayId);
  });
}

export function removeParticipant(userId: number, dayId: number, personId: number): DayState {
  const row = readDay(userId, dayId);
  if (String(row.status) === "closed") {
    throw new StoreError("giornata_chiusa", "La giornata è chiusa", 409);
  }
  const mv = getDb()
    .prepare("SELECT COUNT(*) AS n FROM movements WHERE day_id = ? AND person_id = ?")
    .get(dayId, personId) as Row;
  if (num(mv.n) > 0) {
    throw new StoreError(
      "ha_movimenti",
      "Questa persona ha già dei movimenti: azzera il saldo prima di togliere",
      409,
    );
  }
  getDb()
    .prepare("DELETE FROM day_participants WHERE day_id = ? AND person_id = ?")
    .run(dayId, personId);
  return getDayState(userId, dayId);
}

/* -------------------------------- movimenti ------------------------------ */

export function addMovement(
  userId: number,
  dayId: number,
  input: { personId: number; amountCents: number; note?: string | null; clientId?: string | null },
): DayState {
  const row = readDay(userId, dayId);
  if (String(row.status) === "closed") {
    throw new StoreError("giornata_chiusa", "La giornata è chiusa: riaprila per modificarla", 409);
  }
  const amount = Math.round(input.amountCents);
  if (!Number.isFinite(amount) || amount === 0) {
    throw new StoreError("importo_invalido", "Importo non valido");
  }
  if (Math.abs(amount) > 100_000_00) {
    throw new StoreError("importo_invalido", "Importo troppo grande");
  }

  const isParticipant = getDb()
    .prepare("SELECT 1 AS x FROM day_participants WHERE day_id = ? AND person_id = ?")
    .get(dayId, input.personId) as Row | undefined;
  if (!isParticipant) addParticipantRaw(userId, dayId, input.personId);

  getDb()
    .prepare(
      `INSERT INTO movements (day_id, person_id, amount_cents, note, client_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(day_id, client_id) DO NOTHING`,
    )
    .run(
      dayId,
      input.personId,
      amount,
      input.note?.trim() || null,
      input.clientId || null,
      nowIso(),
    );

  return getDayState(userId, dayId);
}

export function deleteMovement(userId: number, dayId: number, movementId: number): DayState {
  const row = readDay(userId, dayId);
  if (String(row.status) === "closed") {
    throw new StoreError("giornata_chiusa", "La giornata è chiusa: riaprila per modificarla", 409);
  }
  getDb().prepare("DELETE FROM movements WHERE id = ? AND day_id = ?").run(movementId, dayId);
  return getDayState(userId, dayId);
}

/* ------------------------------ stato completo --------------------------- */

export function getDayState(userId: number, dayId: number): DayState {
  const row = readDay(userId, dayId);

  const participants = getDb()
    .prepare(
      `SELECT dp.person_id AS person_id,
              COALESCE(p.name, dp.person_name) AS name,
              dp.added_at AS added_at,
              COALESCE(SUM(m.amount_cents), 0) AS total_cents,
              COALESCE(SUM(CASE WHEN m.amount_cents > 0 THEN 1 ELSE 0 END), 0) AS items
         FROM day_participants dp
         LEFT JOIN people p ON p.id = dp.person_id
         LEFT JOIN movements m ON m.day_id = dp.day_id AND m.person_id = dp.person_id
        WHERE dp.day_id = ?
        GROUP BY dp.person_id
        ORDER BY name COLLATE NOCASE ASC`,
    )
    .all(dayId) as Row[];

  const movements = getDb()
    .prepare(
      `SELECT id, person_id, amount_cents, note, client_id, created_at
         FROM movements WHERE day_id = ? ORDER BY id DESC`,
    )
    .all(dayId) as Row[];

  return {
    day: mapDay(row),
    participants: participants.map<Participant>((r) => ({
      personId: num(r.person_id),
      name: String(r.name),
      addedAt: String(r.added_at),
      totalCents: num(r.total_cents),
      items: num(r.items),
    })),
    movements: movements.map<Movement>((r) => ({
      id: num(r.id),
      personId: num(r.person_id),
      amountCents: num(r.amount_cents),
      note: str(r.note),
      clientId: str(r.client_id),
      createdAt: String(r.created_at),
    })),
  };
}

/** Totali cumulativi per persona su tutte le giornate chiuse. */
export function totaliPerPersona(
  userId: number,
): { personId: number; name: string; totalCents: number; days: number; items: number }[] {
  const rows = getDb()
    .prepare(
      `SELECT dp.person_id AS person_id,
              COALESCE(p.name, dp.person_name) AS name,
              COUNT(DISTINCT dp.day_id) AS days,
              COALESCE(SUM(m.amount_cents), 0) AS total_cents,
              COALESCE(SUM(CASE WHEN m.amount_cents > 0 THEN 1 ELSE 0 END), 0) AS items
         FROM day_participants dp
         JOIN days d ON d.id = dp.day_id AND d.user_id = ?
         LEFT JOIN people p ON p.id = dp.person_id
         LEFT JOIN movements m ON m.day_id = dp.day_id AND m.person_id = dp.person_id
        GROUP BY dp.person_id
        ORDER BY total_cents DESC`,
    )
    .all(userId) as Row[];
  return rows.map((r) => ({
    personId: num(r.person_id),
    name: String(r.name),
    totalCents: num(r.total_cents),
    days: num(r.days),
    items: num(r.items),
  }));
}
