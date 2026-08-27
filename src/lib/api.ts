import { StoreError } from "./store";

/** Converte qualunque errore in una Response JSON coerente. */
export function toResponse(err: unknown): Response {
  if (err instanceof Response) return err;
  if (err instanceof StoreError) {
    return Response.json(
      { error: err.message, code: err.code, ...err.extra },
      { status: err.status },
    );
  }
  console.error("[api]", err);
  return Response.json({ error: "Errore interno del server" }, { status: 500 });
}

/** Avvolge un handler di route: cattura le Response lanciate e gli StoreError. */
export function route<A extends unknown[]>(
  handler: (...args: A) => Promise<Response>,
): (...args: A) => Promise<Response> {
  return async (...args: A) => {
    try {
      return await handler(...args);
    } catch (err) {
      return toResponse(err);
    }
  };
}

export async function readJson<T>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw Response.json({ error: "Corpo della richiesta non valido" }, { status: 400 });
  }
}

export function intParam(value: string, label = "id"): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) {
    throw Response.json({ error: `Parametro ${label} non valido` }, { status: 400 });
  }
  return n;
}
