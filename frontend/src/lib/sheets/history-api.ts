import {
  historyEntrySchema,
  historyGetResponseSchema,
  historyListResponseSchema,
  regenerateResponseSchema,
  type HistoryEntry,
} from "@/lib/sheets/schemas";
import type { z } from "zod";

/**
 * History REST client (004, contracts/rest-api.md) shared by the generator
 * search page and the dedicated sheet page islands. Runtime fetch only (R11).
 */

const DEFAULT_API_BASE = "http://localhost:8000";

export const HISTORY_PAGE_SIZE = 10;

export const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function resolveApiBase(override?: string): string {
  const raw =
    override?.trim() ||
    (import.meta.env?.PUBLIC_API_URL as string | undefined)?.trim() ||
    DEFAULT_API_BASE;
  return raw.replace(/\/+$/, "");
}

/**
 * The backend answered with a non-2xx status. The service responded, so the
 * learner's connection is not the problem (provider outages surface this way).
 */
export class HttpStatusError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

/** Thrown for a 404 so callers can render the not-found view (FR-015). */
export class NotFoundError extends HttpStatusError {
  constructor(url: string) {
    super(url, 404);
  }
}

async function request(url: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(url, init);
  if (res.status === 404) throw new NotFoundError(url);
  if (!res.ok)
    throw new HttpStatusError(
      `${init?.method ?? "GET"} ${url}: ${res.status}`,
      res.status,
    );
  return res;
}

export interface HistoryQuery {
  /** 1-based page number. */
  page: number;
  name?: string;
  favoritesOnly?: boolean;
}

export async function listHistory(
  apiBase: string,
  { page, name, favoritesOnly }: HistoryQuery,
): Promise<z.infer<typeof historyListResponseSchema>> {
  const params = new URLSearchParams({
    limit: String(HISTORY_PAGE_SIZE),
    offset: String((page - 1) * HISTORY_PAGE_SIZE),
  });
  const term = name?.trim();
  if (term) params.set("q", term);
  if (favoritesOnly) params.set("favorite", "true");
  const res = await request(`${apiBase}/api/v1/history?${params}`);
  return historyListResponseSchema.parse(await res.json());
}

/** Number of pages for `total` entries (at least 1, so "Page 1 of 1"). */
export function pageCount(total: number): number {
  return Math.max(1, Math.ceil(total / HISTORY_PAGE_SIZE));
}

export async function getHistoryEntry(
  apiBase: string,
  id: string,
): Promise<z.infer<typeof historyGetResponseSchema>> {
  const res = await request(`${apiBase}/api/v1/history/${id}`);
  return historyGetResponseSchema.parse(await res.json());
}

export async function regenerateHistoryEntry(
  apiBase: string,
  id: string,
): Promise<z.infer<typeof regenerateResponseSchema>> {
  const res = await request(`${apiBase}/api/v1/history/${id}/regenerate`, {
    method: "POST",
  });
  return regenerateResponseSchema.parse(await res.json());
}

export async function deleteHistoryEntry(
  apiBase: string,
  id: string,
): Promise<void> {
  await request(`${apiBase}/api/v1/history/${id}`, { method: "DELETE" });
}

export async function setHistoryFavorite(
  apiBase: string,
  id: string,
  favorite: boolean,
): Promise<HistoryEntry> {
  const res = await request(`${apiBase}/api/v1/history/${id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ favorite }),
  });
  return historyEntrySchema.parse(await res.json());
}

/** Full-page navigation; a seam so tests can observe it (jsdom has none). */
export function navigateTo(href: string, { replace = false } = {}): void {
  if (replace) window.location.replace(href);
  else window.location.assign(href);
}
