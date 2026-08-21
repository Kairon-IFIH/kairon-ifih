import type { ApiError, ApiResponse, AuthTokens } from "../types/api";

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000/api/v1";

/**
 * Tokens live in sessionStorage: gone when the tab/browser closes, but
 * survive a refresh or reopening the URL in the same tab — a plain reload
 * no longer requires logging back in. Still never localStorage (that would
 * persist indefinitely across restarts). Module-level variables mirror
 * storage for synchronous reads without a sessionStorage round-trip on
 * every request; storage read happens once, at module load.
 */
const ACCESS_TOKEN_KEY = "kairon.accessToken";
const REFRESH_TOKEN_KEY = "kairon.refreshToken";

function readStoredToken(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    // Storage can throw in a locked-down context (private-mode Safari, some
    // embedded webviews) — fall back to memory-only rather than crash.
    return null;
  }
}

let accessToken: string | null = readStoredToken(ACCESS_TOKEN_KEY);
let refreshToken: string | null = readStoredToken(REFRESH_TOKEN_KEY);
let onUnauthorized: (() => void) | null = null;

export function setTokens(tokens: AuthTokens | null): void {
  accessToken = tokens?.accessToken ?? null;
  refreshToken = tokens?.refreshToken ?? null;
  try {
    if (tokens) {
      sessionStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken);
      sessionStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
    } else {
      sessionStorage.removeItem(ACCESS_TOKEN_KEY);
      sessionStorage.removeItem(REFRESH_TOKEN_KEY);
    }
  } catch {
    // Same fallback as above — the in-memory copy above still works for
    // this tab's lifetime even if persistence itself is unavailable.
  }
}

export function getAccessToken(): string | null {
  return accessToken;
}

export function onSessionExpired(handler: () => void): void {
  onUnauthorized = handler;
}

export class ApiRequestError extends Error {
  status: number;
  errors: string[];

  constructor(message: string, status: number, errors: string[]) {
    super(message);
    this.status = status;
    this.errors = errors;
  }
}

let refreshInFlight: Promise<boolean> | null = null;

async function refreshAccessToken(): Promise<boolean> {
  if (!refreshToken) return false;
  if (!refreshInFlight) {
    refreshInFlight = fetch(`${BASE_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    })
      .then(async (res) => {
        if (!res.ok) return false;
        const body = (await res.json()) as ApiResponse<AuthTokens>;
        if (!body.success) return false;
        setTokens(body.data);
        return true;
      })
      .catch(() => false)
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
}

function buildUrl(path: string, query?: RequestOptions["query"]): string {
  // The URL constructor throws synchronously if the first argument isn't
  // itself absolute — which BASE_URL isn't in production (it's the relative
  // "/api/v1", baked in at build time so the SPA calls same-origin and never
  // needs the deploy host's IP). Passing location.origin as the base makes
  // both the relative-in-prod and absolute-in-dev (http://localhost:3000/...)
  // forms resolve correctly; an already-absolute URL simply ignores the base.
  const url = new URL(`${BASE_URL}${path}`, window.location.origin);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

async function rawRequest<T>(path: string, options: RequestOptions): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  const res = await fetch(buildUrl(path, options.query), {
    method: options.method ?? "GET",
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const body = (await res.json().catch(() => null)) as ApiResponse<T> | null;

  if (!res.ok) {
    const message = body && !body.success ? body.message : res.statusText;
    const errors = body && !body.success ? (body as ApiError).errors : [];
    throw new ApiRequestError(message, res.status, errors);
  }
  if (!body || !body.success) {
    throw new ApiRequestError(body?.message ?? "Request failed", res.status, []);
  }
  return body.data;
}

/** The one entry point every endpoint function in lib/endpoints.ts goes through — attaches the token and retries once after a silent refresh on 401. */
export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  try {
    return await rawRequest<T>(path, options);
  } catch (err) {
    if (err instanceof ApiRequestError && err.status === 401 && refreshToken) {
      const refreshed = await refreshAccessToken();
      if (refreshed) return rawRequest<T>(path, options);
    }
    if (err instanceof ApiRequestError && err.status === 401) {
      setTokens(null);
      onUnauthorized?.();
    }
    throw err;
  }
}

async function rawTextRequest<T>(path: string, body: string): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "text/csv" };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  const res = await fetch(`${BASE_URL}${path}`, { method: "POST", headers, body });
  const parsed = (await res.json().catch(() => null)) as ApiResponse<T> | null;

  if (!res.ok || !parsed || !parsed.success) {
    const message = parsed && !parsed.success ? parsed.message : res.statusText;
    const errors = parsed && !parsed.success ? (parsed as ApiError).errors : [];
    throw new ApiRequestError(message, res.status, errors);
  }
  return parsed.data;
}

/** CSV import is the one endpoint that takes a raw text body instead of JSON (apps/api/src/main.ts routes it to a text() parser). */
export async function apiTextRequest<T>(path: string, body: string): Promise<T> {
  try {
    return await rawTextRequest<T>(path, body);
  } catch (err) {
    if (err instanceof ApiRequestError && err.status === 401 && refreshToken) {
      const refreshed = await refreshAccessToken();
      if (refreshed) return rawTextRequest<T>(path, body);
    }
    if (err instanceof ApiRequestError && err.status === 401) {
      setTokens(null);
      onUnauthorized?.();
    }
    throw err;
  }
}
