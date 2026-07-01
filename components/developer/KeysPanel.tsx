"use client"

import { useCallback, useEffect, useState } from "react"

const SCOPES = [
  { id: "read:collection", label: "Collezione" },
  { id: "read:market", label: "Marketplace" },
  { id: "read:auction", label: "Aste" },
  { id: "read:trade", label: "Scambi" },
  { id: "read:showcase", label: "Vetrine" },
  { id: "read:groups", label: "Gruppi" },
  { id: "read:analytics", label: "Analytics" },
  { id: "read:advisor", label: "AI Advisor" },
]

interface ApiKeyRow {
  id: string
  label: string
  keyPrefix: string
  scopes: string[]
  active: boolean
  callCount: number
  rateLimitPerMin: number
  lastUsedAt: string | null
  createdAt: string
}

export default function KeysPanel({ token }: { token: string | null }) {
  const [keys, setKeys] = useState<ApiKeyRow[]>([])
  const [loading, setLoading] = useState(true)
  const [label, setLabel] = useState("")
  const [selected, setSelected] = useState<string[]>(["read:collection"])
  const [creating, setCreating] = useState(false)
  const [newKey, setNewKey] = useState<string | null>(null)
  const [error, setError] = useState("")
  const [copied, setCopied] = useState(false)

  const headers = useCallback(
    () => ({ "Content-Type": "application/json", Authorization: `Bearer ${token}` }),
    [token],
  )

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/developer/keys", { headers: headers() })
      const data = await res.json()
      if (data.success) setKeys(data.keys)
    } catch {
      setError("Impossibile caricare le chiavi.")
    } finally {
      setLoading(false)
    }
  }, [headers])

  useEffect(() => {
    if (token) load()
  }, [token, load])

  function toggleScope(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]))
  }

  async function create() {
    setError("")
    if (selected.length === 0) {
      setError("Seleziona almeno uno scope.")
      return
    }
    setCreating(true)
    try {
      const res = await fetch("/api/developer/keys", {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({ label: label || "API key", scopes: selected }),
      })
      const data = await res.json()
      if (data.success) {
        setNewKey(data.key.rawKey)
        setLabel("")
        setSelected(["read:collection"])
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

  async function revoke(id: string) {
    if (!confirm("Revocare definitivamente questa API key?")) return
    await fetch(`/api/developer/keys/${id}`, { method: "DELETE", headers: headers() })
    load()
  }

  function copyKey() {
    if (!newKey) return
    navigator.clipboard.writeText(newKey)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-6">
      {/* New-key reveal banner */}
      {newKey && (
        <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-950/40">
          <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">
            La tua nuova API key (mostrata una sola volta)
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <code className="flex-1 break-all rounded-md bg-white px-3 py-2 font-mono text-sm text-neutral-800 dark:bg-neutral-900 dark:text-neutral-200">
              {newKey}
            </code>
            <button
              type="button"
              onClick={copyKey}
              className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700"
            >
              {copied ? "Copiata" : "Copia"}
            </button>
            <button
              type="button"
              onClick={() => setNewKey(null)}
              className="rounded-md px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-100 dark:text-emerald-400 dark:hover:bg-emerald-900/40"
            >
              Chiudi
            </button>
          </div>
        </div>
      )}

      {/* Create form */}
      <div className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950">
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Crea una nuova chiave</h2>
        <div className="mt-4 space-y-4">
          <div>
            <label htmlFor="key-label" className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
              Etichetta
            </label>
            <input
              id="key-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="es. Integrazione personale"
              className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-emerald-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
            />
          </div>
          <div>
            <span className="mb-2 block text-sm font-medium text-neutral-700 dark:text-neutral-300">Permessi (scopes)</span>
            <div className="flex flex-wrap gap-2">
              {SCOPES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => toggleScope(s.id)}
                  className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                    selected.includes(s.id)
                      ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                      : "border-neutral-300 text-neutral-600 hover:border-neutral-400 dark:border-neutral-700 dark:text-neutral-400"
                  }`}
                >
                  {s.label}
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
            {creating ? "Creazione…" : "Genera API key"}
          </button>
        </div>
      </div>

      {/* Keys list */}
      <div className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950">
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Le tue chiavi</h2>
        {loading ? (
          <p className="mt-4 text-sm text-neutral-500">Caricamento…</p>
        ) : keys.length === 0 ? (
          <p className="mt-4 text-sm text-neutral-500">Nessuna API key. Creane una qui sopra.</p>
        ) : (
          <ul className="mt-4 divide-y divide-neutral-200 dark:divide-neutral-800">
            {keys.map((k) => (
              <li key={k.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-neutral-900 dark:text-neutral-100">{k.label || "API key"}</span>
                    {!k.active && (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-950/50 dark:text-red-400">
                        Revocata
                      </span>
                    )}
                  </div>
                  <code className="font-mono text-xs text-neutral-500">{k.keyPrefix}</code>
                  <p className="mt-1 text-xs text-neutral-500">
                    {k.scopes.join(", ")} · {k.callCount} chiamate · {k.rateLimitPerMin}/min
                  </p>
                </div>
                {k.active && (
                  <button
                    type="button"
                    onClick={() => revoke(k.id)}
                    className="rounded-md border border-red-300 px-3 py-1.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950/40"
                  >
                    Revoca
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
