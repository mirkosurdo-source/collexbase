"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"

type Alert = {
  _id: string
  cardId: string
  label: string
  targetPrice: number
  direction: string
  active: boolean
  triggerCount: number
  lastTriggeredPrice: number
}

type AutoOffer = {
  _id: string
  listingId: string
  listingName: string
  maxPrice: number
  increment: number
  lastOffer: number
  offersSent: number
  active: boolean
  closedReason: string
}

const DIRECTION_LABEL: Record<string, string> = {
  below: "Scende sotto",
  above: "Sale sopra",
  reaches: "Raggiunge",
  swing: "Oscillazione 24h",
}

const CLOSED_LABEL: Record<string, string> = {
  cap: "Limite massimo raggiunto",
  accepted: "Offerta accettata",
  cancelled: "Annullata",
}

function eur(value: number): string {
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(value)
}

function authHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {}
  const t = localStorage.getItem("token")
  return t ? { Authorization: `Bearer ${t}` } : {}
}

export default function MarketAlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [autoOffers, setAutoOffers] = useState<AutoOffer[]>([])
  const [loading, setLoading] = useState(true)
  const [unauth, setUnauth] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([
      fetch("/api/marketplace/price-alert/list", { headers: authHeaders() }),
      fetch("/api/marketplace/auto-offer/list", { headers: authHeaders() }),
    ])
      .then(async ([aRes, oRes]) => {
        if (aRes.status === 401 || oRes.status === 401) {
          setUnauth(true)
          return
        }
        const a = await aRes.json()
        const o = await oRes.json()
        if (a?.success) setAlerts(a.alerts)
        if (o?.success) setAutoOffers(o.autoOffers)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function deleteAlert(id: string) {
    await fetch("/api/marketplace/price-alert/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ alertId: id }),
    })
    setAlerts((prev) => prev.filter((a) => a._id !== id))
  }

  async function cancelAutoOffer(id: string) {
    await fetch("/api/marketplace/auto-offer/cancel", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ autoOfferId: id }),
    })
    load()
  }

  if (unauth) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="text-xl font-semibold text-neutral-900 dark:text-neutral-50">Accedi per vedere i tuoi alert</h1>
        <Link href="/login" className="mt-4 inline-block rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-neutral-50 dark:bg-neutral-100 dark:text-neutral-900">
          Accedi
        </Link>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">Alert &amp; Auto-offerte</h1>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          Gestisci i tuoi avvisi di prezzo e le offerte automatiche.
        </p>
      </header>

      {/* Price alerts */}
      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold text-neutral-900 dark:text-neutral-50">Alert di prezzo</h2>
        {loading ? (
          <div className="h-20 animate-pulse rounded-xl bg-neutral-100 dark:bg-neutral-900" />
        ) : alerts.length === 0 ? (
          <p className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-6 text-sm text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400">
            Nessun alert attivo. Crea un alert dalla pagina di un oggetto.
          </p>
        ) : (
          <ul className="space-y-2">
            {alerts.map((a) => (
              <li
                key={a._id}
                className="flex items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-white px-4 py-3 dark:border-neutral-800 dark:bg-neutral-950"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-neutral-900 dark:text-neutral-50">{a.label || a.cardId}</p>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    {DIRECTION_LABEL[a.direction] || a.direction} {eur(a.targetPrice)}
                    {a.triggerCount > 0 ? ` · attivato ${a.triggerCount}×` : ""}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => deleteAlert(a._id)}
                  className="shrink-0 rounded-md border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-900"
                >
                  Elimina
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Auto-offers */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-neutral-900 dark:text-neutral-50">Offerte automatiche</h2>
        {loading ? (
          <div className="h-20 animate-pulse rounded-xl bg-neutral-100 dark:bg-neutral-900" />
        ) : autoOffers.length === 0 ? (
          <p className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-6 text-sm text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400">
            Nessuna auto-offerta. Attivane una dalla pagina di un oggetto.
          </p>
        ) : (
          <ul className="space-y-2">
            {autoOffers.map((o) => (
              <li
                key={o._id}
                className="flex items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-white px-4 py-3 dark:border-neutral-800 dark:bg-neutral-950"
              >
                <div className="min-w-0">
                  <Link
                    href={`/market/item/${o.listingId}`}
                    className="truncate text-sm font-medium text-neutral-900 hover:underline dark:text-neutral-50"
                  >
                    {o.listingName || "Annuncio"}
                  </Link>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    Max {eur(o.maxPrice)} · step {eur(o.increment)} · {o.offersSent} offerte
                    {o.lastOffer > 0 ? ` · ultima ${eur(o.lastOffer)}` : ""}
                  </p>
                </div>
                {o.active ? (
                  <button
                    type="button"
                    onClick={() => cancelAutoOffer(o._id)}
                    className="shrink-0 rounded-md border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-900"
                  >
                    Annulla
                  </button>
                ) : (
                  <span className="shrink-0 rounded-full bg-neutral-100 px-2.5 py-1 text-xs text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
                    {CLOSED_LABEL[o.closedReason] || "Chiusa"}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}
