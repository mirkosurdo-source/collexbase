"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import StatusPill from "@/components/StatusPill"

interface Transaction {
  id: string
  type: string
  currency: string
  amount: number
  description: string
  status: string
  createdAt: string
}

interface Shipment {
  _id: string
  carrier: string
  trackingNumber: string
  status: string
}

interface Escrow {
  _id: string
  role: "buyer" | "seller"
  listingName: string
  price: number
  sellerFee: number
  status: string
  releaseAt: string
  shipment: Shipment | null
}

const escrowToneMap: Record<string, "neutral" | "success" | "danger" | "warning"> = {
  locked: "warning",
  shipped: "neutral",
  released: "success",
  refunded: "danger",
  disputed: "danger",
}

const escrowLabel: Record<string, string> = {
  locked: "Fondi bloccati",
  shipped: "Spedito",
  released: "Completato",
  refunded: "Rimborsato",
  disputed: "In contestazione",
}

function formatEUR(value: number): string {
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 2 }).format(value)
}

export default function TransactionsPage() {
  const router = useRouter()
  const [tab, setTab] = useState<"movimenti" | "protetti">("movimenti")
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [escrows, setEscrows] = useState<Escrow[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState("")

  const load = useCallback(async () => {
    const token = localStorage.getItem("token")
    if (!token) {
      router.push("/login")
      return
    }
    try {
      const [txRes, escrowRes] = await Promise.all([
        fetch("/api/wallet/transactions", { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/wallet/escrows", { headers: { Authorization: `Bearer ${token}` } }),
      ])
      if (txRes.status === 401 || escrowRes.status === 401) {
        router.push("/login")
        return
      }
      const txData = await txRes.json()
      const escrowData = await escrowRes.json()
      if (txRes.ok) setTransactions(txData.transactions || [])
      if (escrowRes.ok) setEscrows(escrowData.escrows || [])
    } catch {
      setError("Errore di rete.")
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => {
    load()
  }, [load])

  async function confirmReceipt(escrowId: string) {
    const token = localStorage.getItem("token")
    if (!token) return
    setBusyId(escrowId)
    setError("")
    try {
      const res = await fetch("/api/wallet/release-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ escrowId }),
      })
      const data = await res.json()
      if (res.ok) {
        await load()
      } else {
        setError(data.message || data.error || "Operazione non riuscita.")
      }
    } catch {
      setError("Errore di rete.")
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-foreground">Movimenti e pagamenti</h1>
        <Link href="/wallet" className="text-sm text-muted-foreground hover:text-foreground">
          {"← Torna al wallet"}
        </Link>
      </div>

      <div className="mb-6 inline-flex rounded-lg border border-border bg-card p-1">
        <button
          onClick={() => setTab("movimenti")}
          className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            tab === "movimenti" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Movimenti
        </button>
        <button
          onClick={() => setTab("protetti")}
          className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            tab === "protetti" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {`Pagamenti protetti (${escrows.length})`}
        </button>
      </div>

      {error && (
        <p className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Caricamento…</p>
      ) : tab === "movimenti" ? (
        transactions.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border py-16 text-center">
            <p className="text-muted-foreground">Nessun movimento registrato.</p>
          </div>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border bg-card">
            {transactions.map((tx) => (
              <li key={tx.id} className="flex items-center justify-between gap-4 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{tx.description}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(tx.createdAt).toLocaleString("it-IT")}
                  </p>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-semibold ${tx.amount >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-foreground"}`}>
                    {tx.amount >= 0 ? "+" : ""}
                    {tx.currency === "coins"
                      ? `${tx.amount.toLocaleString("it-IT")} coins`
                      : formatEUR(tx.amount)}
                  </p>
                  <p className="text-xs text-muted-foreground capitalize">{tx.status}</p>
                </div>
              </li>
            ))}
          </ul>
        )
      ) : escrows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border py-16 text-center">
          <p className="text-muted-foreground">Nessun pagamento protetto attivo.</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {escrows.map((escrow) => (
            <li key={escrow._id} className="rounded-lg border border-border bg-card p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium text-foreground">{escrow.listingName}</p>
                  <p className="text-sm text-muted-foreground">
                    {escrow.role === "buyer" ? "Acquisto" : "Vendita"}
                    {" · "}
                    {formatEUR(escrow.price)}
                    {escrow.role === "seller" && escrow.sellerFee > 0
                      ? ` (commissione ${formatEUR(escrow.sellerFee)})`
                      : ""}
                  </p>
                </div>
                <StatusPill tone={escrowToneMap[escrow.status] || "neutral"}>
                  {escrowLabel[escrow.status] || escrow.status}
                </StatusPill>
              </div>

              {escrow.shipment && (
                <div className="mt-3 rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
                  {`Spedizione ${escrow.shipment.carrier} · ${escrow.shipment.trackingNumber} · ${escrow.shipment.status}`}
                </div>
              )}

              {escrow.role === "buyer" && (escrow.status === "locked" || escrow.status === "shipped") && (
                <div className="mt-3 flex items-center gap-3">
                  <button
                    onClick={() => confirmReceipt(escrow._id)}
                    disabled={busyId === escrow._id}
                    className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
                  >
                    {busyId === escrow._id ? "Conferma…" : "Conferma ricezione e rilascia pagamento"}
                  </button>
                  <span className="text-xs text-muted-foreground">
                    {`Rilascio automatico il ${new Date(escrow.releaseAt).toLocaleDateString("it-IT")}`}
                  </span>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
