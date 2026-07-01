"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import StatusPill from "@/components/StatusPill"

interface Offer {
  _id: string
  listingId: string
  listingTitle: string
  listingImage: string
  type: "cash" | "trade" | "hybrid"
  fromUserId: string
  fromUsername: string
  toUserId: string
  toUsername: string
  amount: number
  offeredItemName: string
  message: string
  status: "pending" | "accepted" | "rejected" | "countered" | "withdrawn"
  fairness: string
  createdAt: string
}

const statusTone: Record<string, "neutral" | "success" | "danger" | "warning"> = {
  pending: "warning",
  accepted: "success",
  rejected: "danger",
  countered: "neutral",
  withdrawn: "neutral",
}

const statusLabel: Record<string, string> = {
  pending: "In attesa",
  accepted: "Accettata",
  rejected: "Rifiutata",
  countered: "Controproposta",
  withdrawn: "Ritirata",
}

const typeLabel: Record<string, string> = {
  cash: "Contanti",
  trade: "Scambio",
  hybrid: "Misto",
}

export default function OffersPage() {
  const router = useRouter()
  const [tab, setTab] = useState<"received" | "sent">("received")
  const [received, setReceived] = useState<Offer[]>([])
  const [sent, setSent] = useState<Offer[]>([])
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
      const res = await fetch("/api/market/offers", {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.status === 401) {
        router.push("/login")
        return
      }
      const data = await res.json()
      if (res.ok) {
        setReceived(data.received || [])
        setSent(data.sent || [])
      } else {
        setError(data.error || "Errore nel caricamento delle offerte.")
      }
    } catch {
      setError("Errore di rete.")
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => {
    load()
  }, [load])

  async function respond(offerId: string, action: "accept" | "reject") {
    const token = localStorage.getItem("token")
    if (!token) return
    setBusyId(offerId)
    setError("")
    try {
      const res = await fetch("/api/market/offer/respond", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ offerId, action }),
      })
      const data = await res.json()
      if (res.ok) {
        await load()
      } else {
        setError(data.error || "Operazione non riuscita.")
      }
    } catch {
      setError("Errore di rete.")
    } finally {
      setBusyId(null)
    }
  }

  const offers = tab === "received" ? received : sent

  return (
    <div className="py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-foreground">Le mie offerte</h1>
        <Link href="/market" className="text-sm text-muted-foreground hover:text-foreground">
          {"← Torna al mercato"}
        </Link>
      </div>

      <div className="mb-6 inline-flex rounded-lg border border-border bg-card p-1">
        <button
          onClick={() => setTab("received")}
          className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            tab === "received" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {`Ricevute (${received.length})`}
        </button>
        <button
          onClick={() => setTab("sent")}
          className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            tab === "sent" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {`Inviate (${sent.length})`}
        </button>
      </div>

      {error && (
        <p className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Caricamento…</p>
      ) : offers.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border py-16 text-center">
          <p className="text-muted-foreground">
            {tab === "received" ? "Non hai ancora ricevuto offerte." : "Non hai ancora inviato offerte."}
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {offers.map((offer) => (
            <li key={offer._id} className="rounded-lg border border-border bg-card p-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <Link href={`/market/item/${offer.listingId}`} className="flex items-center gap-3">
                  {offer.listingImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={offer.listingImage || "/placeholder.svg"}
                      alt={offer.listingTitle}
                      className="h-14 w-14 rounded-md object-cover"
                    />
                  ) : (
                    <div className="h-14 w-14 rounded-md bg-muted" />
                  )}
                  <div>
                    <p className="font-medium text-foreground">{offer.listingTitle}</p>
                    <p className="text-sm text-muted-foreground">
                      {tab === "received" ? `da ${offer.fromUsername}` : `a ${offer.toUsername}`}
                    </p>
                  </div>
                </Link>

                <div className="flex flex-col items-start gap-2 sm:items-end">
                  <div className="flex items-center gap-2">
                    <StatusPill tone="neutral">{typeLabel[offer.type]}</StatusPill>
                    <StatusPill tone={statusTone[offer.status]}>{statusLabel[offer.status]}</StatusPill>
                  </div>
                  {offer.amount > 0 && (
                    <p className="text-lg font-semibold text-foreground">{`€ ${offer.amount.toLocaleString("it-IT")}`}</p>
                  )}
                  {offer.offeredItemName && (
                    <p className="text-sm text-muted-foreground">{`Oggetto: ${offer.offeredItemName}`}</p>
                  )}
                </div>
              </div>

              {offer.message && <p className="mt-3 text-sm text-muted-foreground">{`"${offer.message}"`}</p>}
              {offer.fairness && (
                <p className="mt-2 text-xs text-muted-foreground">{`Valutazione AI: ${offer.fairness}`}</p>
              )}

              {tab === "received" && offer.status === "pending" && (
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={() => respond(offer._id, "accept")}
                    disabled={busyId === offer._id}
                    className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
                  >
                    Accetta
                  </button>
                  <button
                    onClick={() => respond(offer._id, "reject")}
                    disabled={busyId === offer._id}
                    className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50"
                  >
                    Rifiuta
                  </button>
                  <Link
                    href={`/market/item/${offer.listingId}`}
                    className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
                  >
                    Controproponi
                  </Link>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
