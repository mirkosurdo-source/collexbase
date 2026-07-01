"use client"

import { useCallback, useEffect, useState } from "react"

const EVENTS = [
  "market.new",
  "market.sold",
  "auction.new",
  "auction.bid",
  "trade.proposed",
  "trade.completed",
  "collection.updated",
  "showcase.updated",
  "group.posted",
  "moderation.flagged",
]

interface WebhookRow {
  id: string
  url: string
  events: string[]
  secret: string
  active: boolean
  deliveredCount: number
  failureStreak: number
  lastDeliveryAt: string | null
  lastError: string | null
  disabledReason: string | null
}

export default function WebhooksPanel({ token }: { token: string | null }) {
  const [hooks, setHooks] = useState<WebhookRow[]>([])
  const [loading, setLoading] = useState(true)
  const [url, setUrl] = useState("")
  const [selected, setSelected] = useState<string[]>([])
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState("")
  const [testing, setTesting] = useState<string | null>(null)
  const [revealSecret, setRevealSecret] = useState<string | null>(null)

  const headers = useCallback(
    () => ({ "Content-Type": "application/json", Authorization: `Bearer ${token}` }),
    [token],
  )

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/developer/webhooks", { headers: headers() })
      const data = await res.json()
      if (data.success) setHooks(data.webhooks)
    } catch {
      setError("Impossibile caricare i webhook.")
    } finally {
      setLoading(false)
    }
  }, [headers])

  useEffect(() => {
    if (token) load()
  }, [token, load])

  function toggleEvent(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((e) => e !== id) : [...prev, id]))
  }

  async function create() {
    setError("")
    if (!/^https?:\/\//i.test(url)) {
      setError("Inserisci un URL valido (http/https).")
      return
    }
    if (selected.length === 0) {
      setError("Seleziona almeno un evento.")
      return
    }
    setCreating(true)
    try {
      const res = await fetch("/api/developer/webhooks", {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({ url, events: selected }),
      })
      const data = await res.json()
      if (data.success) {
        setUrl("")
        setSelected([])
        load()
      } else {
        setError(data.message || "Errore durante la creazione.")
      }
    } catch {
      setError("Errore di rete.")
    } finally {
      setCreating(false)
    }
  }

  async function test(id: string) {
    setTesting(id)
    try {
      await fetch(`/api/developer/webhooks/${id}/test`, { method: "POST", headers: headers() })
      await load()
    } finally {
      setTesting(null)
    }
  }

  async function remove(id: string) {
    if (!confirm("Eliminare questo webhook?")) return
    await fetch(`/api/developer/webhooks/${id}`, { method: "DELETE", headers: headers() })
    load()
  }

  return (
    <div className="space-y-6">
      {/* Create form */}
      <div className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950">
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Nuovo webhook</h2>
        <div className="mt-4 space-y-4">
          <div>
            <label htmlFor="hook-url" className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
              Endpoint URL
            </label>
            <input
              id="hook-url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/webhooks/collexbase"
              className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-emerald-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
            />
          </div>
          <div>
            <span className="mb-2 block text-sm font-medium text-neutral-700 dark:text-neutral-300">Eventi</span>
            <div className="flex flex-wrap gap-2">
              {EVENTS.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => toggleEvent(e)}
                  className={`rounded-full border px-3 py-1.5 font-mono text-xs transition-colors ${
                    selected.includes(e)
                      ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                      : "border-neutral-300 text-neutral-600 hover:border-neutral-400 dark:border-neutral-700 dark:text-neutral-400"
                  }`}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          <button
            type="button"
            onClick={create}
            disabled={creating}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-60"
          >
            {creating ? "Creazione…" : "Aggiungi webhook"}
          </button>
        </div>
      </div>

      {/* List */}
      <div className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950">
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Webhook attivi</h2>
        {loading ? (
          <p className="mt-4 text-sm text-neutral-500">Caricamento…</p>
        ) : hooks.length === 0 ? (
          <p className="mt-4 text-sm text-neutral-500">Nessun webhook configurato.</p>
        ) : (
          <ul className="mt-4 space-y-4">
            {hooks.map((h) => (
              <li key={h.id} className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <code className="break-all font-mono text-sm text-neutral-900 dark:text-neutral-100">{h.url}</code>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          h.active
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400"
                            : "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400"
                        }`}
                      >
                        {h.active ? "Attivo" : "Disattivato"}
                      </span>
                    </div>
                    <p className="mt-1 font-mono text-xs text-neutral-500">{h.events.join(", ")}</p>
                    <p className="mt-1 text-xs text-neutral-500">
                      {h.deliveredCount} consegne
                      {h.failureStreak > 0 ? ` · ${h.failureStreak} fallimenti consecutivi` : ""}
                    </p>
                    {h.lastError && (
                      <p className="mt-1 text-xs text-red-600 dark:text-red-400">Ultimo errore: {h.lastError}</p>
                    )}
                    {h.disabledReason && (
                      <p className="mt-1 text-xs text-red-600 dark:text-red-400">{h.disabledReason}</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => test(h.id)}
                      disabled={testing === h.id}
                      className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-100 disabled:opacity-60 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-900"
                    >
                      {testing === h.id ? "Invio…" : "Test"}
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(h.id)}
                      className="rounded-md border border-red-300 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950/40"
                    >
                      Elimina
                    </button>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setRevealSecret(revealSecret === h.id ? null : h.id)}
                  className="mt-3 text-xs font-medium text-emerald-700 hover:underline dark:text-emerald-400"
                >
                  {revealSecret === h.id ? "Nascondi signing secret" : "Mostra signing secret"}
                </button>
                {revealSecret === h.id && (
                  <code className="mt-1 block break-all rounded-md bg-neutral-100 px-3 py-2 font-mono text-xs text-neutral-700 dark:bg-neutral-900 dark:text-neutral-300">
                    {h.secret}
                  </code>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
