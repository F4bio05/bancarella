/** Formattazione/parsing degli importi. Il denaro e' sempre in centesimi (interi). */

export function formatEuro(cents: number, withSign = false): string {
  const sign = cents < 0 ? "-" : withSign && cents > 0 ? "+" : "";
  const abs = Math.abs(cents);
  const euro = Math.floor(abs / 100);
  const dec = String(abs % 100).padStart(2, "0");
  return `${sign}${euro.toLocaleString("it-IT")},${dec} €`;
}

export function formatEuroPlain(cents: number): string {
  const abs = Math.abs(cents);
  return `${cents < 0 ? "-" : ""}${Math.floor(abs / 100)},${String(abs % 100).padStart(2, "0")}`;
}

const GIORNI = ["domenica", "lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato"];
const MESI = [
  "gennaio",
  "febbraio",
  "marzo",
  "aprile",
  "maggio",
  "giugno",
  "luglio",
  "agosto",
  "settembre",
  "ottobre",
  "novembre",
  "dicembre",
];

/** "2026-08-27" -> "giovedì 27 agosto 2026" */
export function formatDataLunga(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return `${GIORNI[dt.getDay()]} ${d} ${MESI[m - 1]} ${y}`;
}

/** "2026-08-27" -> "27 ago 2026" */
export function formatDataBreve(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  return `${d} ${MESI[m - 1].slice(0, 3)} ${y}`;
}

export function formatOra(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** Data locale di oggi in formato YYYY-MM-DD. */
export function oggiIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
