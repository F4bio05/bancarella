"use client";

export class ApiError extends Error {
  status: number;
  code?: string;
  extra: Record<string, unknown>;
  offline: boolean;
  constructor(message: string, status: number, code?: string, extra: Record<string, unknown> = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.extra = extra;
    this.offline = status === 0;
  }
}

type Options = { method?: string; body?: unknown; signal?: AbortSignal };

export async function api<T>(path: string, opts: Options = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: opts.method ?? "GET",
      headers: opts.body === undefined ? undefined : { "Content-Type": "application/json" },
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      signal: opts.signal,
      cache: "no-store",
    });
  } catch {
    throw new ApiError("Nessuna connessione", 0);
  }

  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    /* risposta senza corpo */
  }

  if (!res.ok) {
    const obj = (data ?? {}) as Record<string, unknown>;
    const { error, code, ...extra } = obj;
    throw new ApiError(
      typeof error === "string" ? error : `Errore ${res.status}`,
      res.status,
      typeof code === "string" ? code : undefined,
      extra,
    );
  }
  return data as T;
}
