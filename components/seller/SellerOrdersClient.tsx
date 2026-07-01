"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { StatusPill } from "@/components/admin/shared"
import {
  fmtDate,
  fmtEUR,
  sellerPost,
  type SellerOrderDTO,
} from "@/components/seller/shared"

const STATUS_FILTERS = [
  { value: "all", label: "Tutti" },
  { value: "paid", label: "Da spedire" },
  { value: "shipped", label: "Spediti" },
  { value: "completed", label: "Completati" },
]

export default function SellerOrdersClient() {
  const router = useRouter()
  const [orders, setOrders] = useState<SellerOrderDTO[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState("all")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const res = await fetch(`/api/seller/orders${filter === "all" ? "" : `?status=${filter}`}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token") || ""}` },
      })
      if (res.status === 401) return router.push("/login")
      if (res.status === 403) return router.push("/seller")
      const json = (await res.json()) as { success: boolean; orders: SellerOrderDTO[]; message?: string }
      if (!json.success) setError(json.message || "Errore di caricamento.")
      else setOrders(json.orders)
    } catch {
      setError("Errore di connessione.")
    } finally {
      setLoading(false)
    }
  }, [filter, router])

  useEffect(() => {
    load()
  }, [load])

  async function ship(o: SellerOrderDTO) {
    const carrier = window.prompt("Corriere (es. BRT, DHL, Poste):", o.trackingCarrier || "")
    if (carrier === null) return
    const tracking = window.prompt("Numero di tracking:", o.trackingNumber || "")
    if (tracking === null) return
    setBusy(o.id)
    try {
      const res = await sellerPost<{ success: boolean; message?: string }>(`/api/seller/orders/${o.id}/ship`, {
        trackingCarrier: carrier,
        trackingNumber: tracking,
      })
      if (!res.success) setError(res.message || "Errore.")
      else await load()
    } finally {
      setBusy(null)
    }
  }

  async function complete(o: SellerOrderDTO) {
    setBusy(o.id)
    try {
      const res = await sellerPost<{ success: boolean; message?: string }>(`/api/seller/orders/${o.id}/complete`, {})
      if (!res.success) setError(res.message || "Errore.")
      else await load()
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Ordini</h1>
        <p className="mt-1 text-sm text-muted-foreground">Gestisci spedizioni e completa gli ordini dei tuoi clienti.</p>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setFilter(f.value)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              filter === f.value
                ? "bg-primary text-primary-foreground"
                : "border border-border bg-background text-muted-foreground hover:bg-accent"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-border border-t-foreground" />
          Caricamento ordini…
        </div>
      ) : orders.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          Nessun ordine in questa categoria.
        </div>
      ) : (
        <ul className="space-y-3">
          {orders.map((o) => (
            <li key={o.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <StatusPill status={o.status} />
                    <span className="text-xs text-muted-foreground">{fmtDate(o.createdAt)}</span>
                  </div>
                  <ul className="mt-2 space-y-1">
                    {o.items.map((i, idx) => (
                      <li key={idx} className="text-sm text-foreground">
                        {i.quantity}× {i.title}{" "}
                        <span className="text-muted-foreground">· {fmtEUR(i.price)}</span>
                      </li>
                    ))}
                  </ul>
                  {o.trackingNumber && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Tracking: {o.trackingCarrier} {o.trackingNumber}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-base font-semibold text-foreground">{fmtEUR(o.total)}</p>
                  <p className="text-xs text-muted-foreground">Netto {fmtEUR(o.payoutAmount)}</p>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap justify-end gap-2 border-t border-border pt-3">
                {o.status === "paid" && (
                  <button
                    type="button"
                    disabled={busy === o.id}
                    onClick={() => ship(o)}
                    className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
                  >
                    Segna come spedito
                  </button>
                )}
                {o.status === "shipped" && (
                  <button
                    type="button"
                    disabled={busy === o.id}
                    onClick={() => complete(o)}
                    className="rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent disabled:opacity-50"
                  >
                    Segna come completato
                  </button>
                )}
                {o.status === "completed" && (
                  <span className="text-xs text-muted-foreground">
                    {o.payoutSettled ? "Payout liquidato" : "Payout in elaborazione"}
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
