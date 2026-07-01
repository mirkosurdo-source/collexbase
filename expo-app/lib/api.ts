/**
 * Thin API client for the CollexBase backend. All endpoints are the same
 * Next.js routes used by the web app (e.g. /api/scan, /api/market/list); the
 * mobile app only adds the stored Bearer token and JSON handling.
 */
import Constants from "expo-constants"
import { getToken } from "./auth"

const BASE_URL: string =
  process.env.EXPO_PUBLIC_API_URL ??
  (Constants.expoConfig?.extra as { apiBaseUrl?: string } | undefined)?.apiBaseUrl ??
  "https://collexbase.app"

export interface ApiResult<T> {
  ok: boolean
  status: number
  data: T | null
  error?: string
}

async function request<T>(
  path: string,
  options: { method?: string; body?: unknown; auth?: boolean } = {},
): Promise<ApiResult<T>> {
  const { method = "GET", body, auth = true } = options
  const headers: Record<string, string> = { "Content-Type": "application/json" }

  if (auth) {
    const token = await getToken()
    if (token) headers.Authorization = `Bearer ${token}`
  }

  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body != null ? JSON.stringify(body) : undefined,
    })
    let json: unknown = null
    try {
      json = await res.json()
    } catch {
      json = null
    }
    if (!res.ok) {
      const errMsg =
        json && typeof json === "object" && "error" in json ? String((json as { error: unknown }).error) : undefined
      return { ok: false, status: res.status, data: null, error: errMsg ?? `HTTP ${res.status}` }
    }
    return { ok: true, status: res.status, data: json as T }
  } catch (e) {
    return { ok: false, status: 0, data: null, error: e instanceof Error ? e.message : "Network error" }
  }
}

export const api = {
  baseUrl: BASE_URL,
  get: <T>(path: string, auth = true) => request<T>(path, { method: "GET", auth }),
  post: <T>(path: string, body?: unknown, auth = true) => request<T>(path, { method: "POST", body, auth }),
  patch: <T>(path: string, body?: unknown, auth = true) => request<T>(path, { method: "PATCH", body, auth }),
  del: <T>(path: string, auth = true) => request<T>(path, { method: "DELETE", auth }),
}
