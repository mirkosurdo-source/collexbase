"use client"

import { useState } from "react"

const ENDPOINTS = [
  "/api/public/collection",
  "/api/public/market/list",
  "/api/public/auction/list",
  "/api/public/trade/list",
  "/api/public/showcase/list",
  "/api/public/groups/list",
  "/api/public/analytics/market",
  "/api/public/analytics/categories",
  "/api/public/analytics/trending",
]

export default function PlaygroundPanel() {
  const [apiKey, setApiKey] = useState("")
  const [endpoint, setEndpoint] = useState(ENDPOINTS[0])
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<number | null>(null)
  const [response, setResponse] = useState("")
  const [rateInfo, setRateInfo] = useState<string | null>(null)

  async function send() {
    if (!apiKey.trim()) {
      setResponse("Inserisci una API key per provare la richiesta.")
      return
    }
    setLoading(true)
    setResponse("")
    setStatus(null)
    setRateInfo(null)
    try {
      const res = await fetch(endpoint, { headers: { Authorization: `Bearer ${apiKey.trim()}` } })
      setStatus(res.status)
      const limit = res.headers.get("X-RateLimit-Limit")
      const remaining = res.headers.get("X-RateLimit-Remaining")
      if (limit) setRateInfo(`${remaining}/${limit} richieste rimaste in questa finestra`)
      const json = await res.json()
      setResponse(JSON.stringify(json, null, 2))
    } catch {
      setResponse("Errore di rete durante la richiesta.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950">
      <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Playground</h2>
      <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
        Prova le API in tempo reale con una delle tue chiavi. La key resta nel browser e non viene salvata.
      </p>

      <div className="mt-4 space-y-4">
        <div>
          <label htmlFor="pg-key" className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
            API key
          </label>
          <input
            id="pg-key"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="cxb_live_…"
            className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 font-mono text-sm text-neutral-900 outline-none focus:border-emerald-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
          />
        </div>
        <div>
          <label htmlFor="pg-endpoint" className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
            Endpoint
          </label>
          <select
            id="pg-endpoint"
            value={endpoint}
            onChange={(e) => setEndpoint(e.target.value)}
            className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 font-mono text-sm text-neutral-900 outline-none focus:border-emerald-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
          >
            {ENDPOINTS.map((e) => (
              <option key={e} value={e}>
                GET {e}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={send}
          disabled={loading}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-60"
        >
          {loading ? "Invio…" : "Invia richiesta"}
        </button>

        {status !== null && (
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span
              className={`rounded-full px-2.5 py-0.5 font-medium ${
                status >= 200 && status < 300
                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400"
                  : "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400"
              }`}
            >
              HTTP {status}
            </span>
            {rateInfo && <span className="text-neutral-500">{rateInfo}</span>}
          </div>
        )}

        {response && (
          <pre className="max-h-96 overflow-auto rounded-lg bg-neutral-900 p-4 text-sm leading-relaxed text-neutral-100 dark:bg-black">
            <code className="font-mono">{response}</code>
          </pre>
        )}
      </div>
    </div>
  )
}
