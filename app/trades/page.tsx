"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"

type Trade = {
  _id: string
  fromUserId: string
  fromUsername?: string
  toUserId: string
  toUsername?: string
  offeredItemName?: string
  offeredItemImage?: string
  requestedItemName?: string
  requestedItemImage?: string
  status: "pending" | "accepted" | "rejected"
  updatedAt: string
}

const STATUS_LABELS: Record<string, string> = {
  pending: "In attesa",
  accepted: "Accettato",
  rejected: "Rifiutato",
}

function statusClasses(status: string): string {
  switch (status) {
    case "accepted":
      return "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400"
    case "rejected":
      return "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400"
    default:
      return "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400"
  }
}

function TradeCard({ trade, direction }: { trade: Trade; direction: "sent" | "received" }) {
  return (
    <Link
      href={`/trades/${trade._id}`}
      className="flex items-center justify-between gap-4 rounded-xl border border-neutral-200 bg-white p-4 transition-colors hover:border-neutral-400 dark:border-neutral-800 dark:bg-neutral-950 dark:hover:border-neutral-600"
    >
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-neutral-100 dark:bg-neutral-900">
            {trade.offeredItemImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={trade.offeredItemImage || "/placeholder.svg"} alt={trade.offeredItemName || ""} className="h-full w-full object-cover" />
            ) : null}
          </div>
          <span className="text-neutral-400">⇄</span>
          <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-neutral-100 dark:bg-neutral-900">
            {trade.requestedItemImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={trade.requestedItemImage || "/placeholder.svg"} alt={trade.requestedItemName || ""} className="h-full w-full object-cover" />
            ) : null}
          </div>
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-neutral-900 dark:text-neutral-100">
            {trade.offeredItemName || "Oggetto"} → {trade.requestedItemName || "Oggetto"}
          </p>
          <p className="truncate text-xs text-neutral-500 dark:text-neutral-400">
            {direction === "sent"
              ? `A ${trade.toUsername || "utente"}`
              : `Da ${trade.fromUsername || "utente"}`}
          </p>
        </div>
      </div>
      <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${statusClasses(trade.status)}`}>
        {STATUS_LABELS[trade.status] || trade.status}
      </span>
    </Link>
  )
}

export default function TradesPage() {
  const router = useRouter()
  const [sent, setSent] = useState<Trade[]>([])
  const [received, setReceived] = useState<Trade[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [tab, setTab] = useState<"received" | "sent">("received")

  const loadTrades = useCallback(async () => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null
    if (!token) {
      router.replace("/login")
      return
    }
    try {
      const res = await fetch("/api/trades/list", {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (data.success) {
        setSent(data.sent || [])
        setReceived(data.received || [])
      } else {
        setError(data.message || "Impossibile caricare gli scambi.")
      }
    } catch {
      setError("Impossibile caricare gli scambi.")
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => {
    loadTrades()
  }, [loadTrades])

  const current = tab === "received" ? received : sent

  return (
    <div className="py-12">
      <div className="mx-auto w-full max-w-3xl">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">Scambi</h1>
          <Link
            href="/trades/new"
            className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-neutral-50 transition-colors hover:bg-neutral-700 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300"
          >
            Nuova proposta
          </Link>
        </div>

        <div className="mt-6 inline-flex rounded-lg border border-neutral-200 p-1 dark:border-neutral-800">
          <button
            onClick={() => setTab("received")}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
              tab === "received"
                ? "bg-neutral-900 text-neutral-50 dark:bg-neutral-100 dark:text-neutral-900"
                : "text-neutral-600 dark:text-neutral-400"
            }`}
          >
            Ricevuti ({received.length})
          </button>
          <button
            onClick={() => setTab("sent")}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
              tab === "sent"
                ? "bg-neutral-900 text-neutral-50 dark:bg-neutral-100 dark:text-neutral-900"
                : "text-neutral-600 dark:text-neutral-400"
            }`}
          >
            Inviati ({sent.length})
          </button>
        </div>

        {loading ? (
          <p className="mt-8 text-sm text-neutral-500 dark:text-neutral-400">Caricamento...</p>
        ) : error ? (
          <p className="mt-8 text-sm text-red-600 dark:text-red-400">{error}</p>
        ) : current.length === 0 ? (
          <div className="mt-8 rounded-xl border border-dashed border-neutral-300 py-12 text-center dark:border-neutral-700">
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              {tab === "received" ? "Nessuno scambio ricevuto." : "Nessuno scambio inviato."}
            </p>
          </div>
        ) : (
          <div className="mt-6 flex flex-col gap-3">
            {current.map((trade) => (
              <TradeCard key={trade._id} trade={trade} direction={tab} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
