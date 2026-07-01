"use client"

import type React from "react"
import { useCallback, useEffect, useState } from "react"
import { useRouter, useParams } from "next/navigation"
import Link from "next/link"
import Countdown from "../Countdown"
import ContactChatButton from "@/components/chat/ContactChatButton"
import WishlistMatchBadge from "@/components/wishlist/WishlistMatchBadge"

type Bid = {
  _id?: string
  userId: string
  username?: string
  amount: number
  createdAt: string
}

type Auction = {
  _id: string
  userId: string
  itemName: string
  description?: string
  image?: string
  startingPrice: number
  currentPrice: number
  minIncrement: number
  bids: Bid[]
  status: "active" | "closed"
  endsAt: string
}

function formatTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleString("it-IT", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
}

export default function AuctionDetailPage() {
  const router = useRouter()
  const params = useParams()
  const id = typeof params.id === "string" ? params.id : Array.isArray(params.id) ? params.id[0] : ""

  const [auction, setAuction] = useState<Auction | null>(null)
  const [isOwner, setIsOwner] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [bidAmount, setBidAmount] = useState("")
  const [bidError, setBidError] = useState("")
  const [bidMessage, setBidMessage] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const loadAuction = useCallback(async () => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null
    if (!token) {
      router.replace("/login")
      return
    }
    try {
      const res = await fetch(`/api/auctions/item?id=${encodeURIComponent(id)}`, {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (data.success) {
        setAuction(data.auction)
        setIsOwner(data.isOwner)
      } else {
        setError(data.message || "Asta non trovata.")
      }
    } catch {
      setError("Impossibile caricare l'asta.")
    } finally {
      setLoading(false)
    }
  }, [id, router])

  useEffect(() => {
    loadAuction()
  }, [loadAuction])

  async function handleBid(e: React.FormEvent) {
    e.preventDefault()
    setBidError("")
    setBidMessage("")

    const amount = Number(bidAmount)
    if (Number.isNaN(amount) || amount <= 0) {
      setBidError("Inserisci un importo valido.")
      return
    }

    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null
    if (!token) {
      router.replace("/login")
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch("/api/auctions/bid", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id, amount }),
      })
      const data = await res.json()
      if (data.success) {
        setBidMessage("Offerta registrata con successo.")
        setBidAmount("")
        setAuction(data.auction)
      } else {
        setBidError(data.message || "Impossibile registrare l'offerta.")
      }
    } catch {
      setBidError("Impossibile registrare l'offerta.")
    } finally {
      setSubmitting(false)
    }
  }

  async function handleClose() {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null
    if (!token) {
      router.replace("/login")
      return
    }
    if (!window.confirm("Vuoi chiudere questa asta?")) return

    try {
      const res = await fetch("/api/auctions/close", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id }),
      })
      const data = await res.json()
      if (data.success) {
        setAuction(data.auction)
      } else {
        setError(data.message || "Impossibile chiudere l'asta.")
      }
    } catch {
      setError("Impossibile chiudere l'asta.")
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <p className="text-sm text-neutral-500 dark:text-neutral-400">Caricamento...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="py-12">
        <div className="mx-auto w-full max-w-2xl text-center">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          <Link href="/auctions" className="mt-4 inline-block text-sm font-medium underline">
            Torna alle aste
          </Link>
        </div>
      </div>
    )
  }

  if (!auction) return null

  const isClosed = auction.status !== "active" || new Date(auction.endsAt) <= new Date()
  const minNext = auction.currentPrice + auction.minIncrement
  const sortedBids = [...auction.bids].sort((a, b) => b.amount - a.amount)

  return (
    <div className="py-12">
      <div className="mx-auto w-full max-w-4xl">
        <Link href="/auctions" className="text-sm text-neutral-500 hover:underline dark:text-neutral-400">
          ← Torna alle aste
        </Link>

        <div className="mt-4 grid grid-cols-1 gap-8 lg:grid-cols-2">
          <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
            <div className="aspect-square w-full overflow-hidden bg-neutral-100 dark:bg-neutral-900">
              {auction.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={auction.image || "/placeholder.svg"} alt={auction.itemName} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-sm text-neutral-400">
                  Nessuna immagine
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col">
            <div className="flex items-start justify-between gap-4">
              <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
                {auction.itemName}
              </h1>
              <span
                className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  isClosed
                    ? "bg-neutral-200 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400"
                    : "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400"
                }`}
              >
                {isClosed ? "Chiusa" : "Attiva"}
              </span>
            </div>

            {!isOwner && (
              <WishlistMatchBadge
                kind="auction"
                name={auction.itemName}
                price={auction.currentPrice}
                className="mt-3"
              />
            )}

            {auction.description && (
              <p className="mt-3 text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">
                {auction.description}
              </p>
            )}

            <div className="mt-6 rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950">
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-xs text-neutral-400">Prezzo attuale</p>
                  <p className="text-3xl font-semibold text-neutral-900 dark:text-neutral-50">€ {auction.currentPrice}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-neutral-400">Tempo rimanente</p>
                  {isClosed ? (
                    <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400">Terminata</p>
                  ) : (
                    <Countdown
                      endsAt={auction.endsAt}
                      onExpire={loadAuction}
                      className="text-sm font-medium text-neutral-700 dark:text-neutral-300"
                    />
                  )}
                </div>
              </div>

              {!isClosed && !isOwner && (
                <form onSubmit={handleBid} className="mt-5 flex flex-col gap-2">
                  <div className="flex gap-2">
                    <input
                      inputMode="numeric"
                      placeholder={`Min. € ${minNext}`}
                      value={bidAmount}
                      onChange={(e) => setBidAmount(e.target.value)}
                      className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none transition-colors focus:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
                    />
                    <button
                      type="submit"
                      disabled={submitting}
                      className="shrink-0 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-neutral-50 transition-colors hover:bg-neutral-700 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300"
                    >
                      {submitting ? "Invio..." : "Fai un'offerta"}
                    </button>
                  </div>
                  {bidError && <p className="text-sm text-red-600 dark:text-red-400">{bidError}</p>}
                  {bidMessage && <p className="text-sm text-green-600 dark:text-green-400">{bidMessage}</p>}
                  <ContactChatButton
                    contextType="auction"
                    contextId={auction._id}
                    label="Chat con il venditore"
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-900"
                  />
                </form>
              )}

              {!isClosed && isOwner && (
                <div className="mt-5 flex flex-col gap-2">
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    Sei il creatore di questa asta e non puoi fare offerte.
                  </p>
                  <button
                    onClick={handleClose}
                    className="rounded-lg border border-red-300 px-3 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
                  >
                    Chiudi asta
                  </button>
                </div>
              )}
            </div>

            <div className="mt-6">
              <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-50">
                Offerte ({sortedBids.length})
              </h2>
              {sortedBids.length === 0 ? (
                <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">Nessuna offerta ancora.</p>
              ) : (
                <ul className="mt-3 flex flex-col divide-y divide-neutral-200 dark:divide-neutral-800">
                  {sortedBids.map((bid, index) => (
                    <li key={bid._id || index} className="flex items-center justify-between py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                          {bid.username || "Utente"}
                        </span>
                        {index === 0 && (
                          <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700 dark:bg-green-950 dark:text-green-400">
                            Migliore
                          </span>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">€ {bid.amount}</p>
                        <p className="text-xs text-neutral-400">{formatTime(bid.createdAt)}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
